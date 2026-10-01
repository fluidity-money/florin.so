'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ConnectWallet, useAuth } from '@zerodev/wallet-react-ui';
import { useMutationState } from '@tanstack/react-query';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import type { EIP1193Provider } from 'viem';
import { captureEvent } from '../../lib/analytics';
import { hasZeroDev } from '../../lib/wagmi';
import { Wallet, WalletContext } from './wallet';

function shortAddr(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

function stripMagicLinkCode() {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  window.history.replaceState(null, '', url.toString());
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const account = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { step: authStep, otpId, reset: resetAuth } = useAuth();
  const magicLinkMutationStatuses = useMutationState({
    filters: { mutationKey: ['verifyMagicLink'] },
    select: (mutation) => mutation.state.status,
  });
  const magicLinkMutationStatus = magicLinkMutationStatuses[magicLinkMutationStatuses.length - 1];
  const [provider, setProvider] = useState<EIP1193Provider | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const recoveringMagicLink = useRef(
    typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).has('code'),
  );
  const recoveryStarted = useRef(false);
  const recoveryFailureCaptured = useRef(false);

  const captureRecoveryResult = useCallback((
    event: 'wallet_connection_succeeded' | 'wallet_connection_failed',
  ) => {
    captureEvent(event, {
      source: 'header',
      route: window.location.pathname,
      wallet_kind: 'zerodev',
    });
  }, []);

  const captureRecoveryFailure = useCallback(() => {
    if (recoveryFailureCaptured.current) return;
    recoveryFailureCaptured.current = true;
    captureRecoveryResult('wallet_connection_failed');
  }, [captureRecoveryResult]);

  const closeRecovery = useCallback(() => {
    stripMagicLinkCode();
    recoveringMagicLink.current = false;
    setLoginOpen(false);
  }, []);

  useEffect(() => {
    if (recoveringMagicLink.current) setLoginOpen(true);
  }, []);

  useEffect(() => {
    if (
      !recoveringMagicLink.current
      || recoveryFailureCaptured.current
      || authStep !== 'verifying-otp'
      || (otpId && magicLinkMutationStatus !== 'error')
    ) return;

    captureRecoveryFailure();
    stripMagicLinkCode();
  }, [authStep, captureRecoveryFailure, magicLinkMutationStatus, otpId]);

  useEffect(() => {
    if (
      !recoveringMagicLink.current
      || recoveryStarted.current
      || authStep !== 'authenticated'
    ) return;

    recoveryStarted.current = true;
    if (account.isConnected) {
      captureRecoveryResult('wallet_connection_succeeded');
      closeRecovery();
      return;
    }

    const connector = connectors.find((candidate) => candidate.id === 'zerodev-wallet');
    if (!connector) {
      captureRecoveryFailure();
      resetAuth();
      closeRecovery();
      return;
    }

    void connectAsync({ connector, chainId: 46630 })
      .then(() => {
        captureRecoveryResult('wallet_connection_succeeded');
        closeRecovery();
      })
      .catch(() => {
        captureRecoveryFailure();
        resetAuth();
        closeRecovery();
      });
  }, [
    account.isConnected,
    authStep,
    captureRecoveryFailure,
    captureRecoveryResult,
    closeRecovery,
    connectAsync,
    connectors,
    resetAuth,
  ]);

  useEffect(() => {
    let active = true;

    if (!account.isConnected || !account.connector) {
      setProvider(null);
      return () => { active = false; };
    }

    void account.connector.getProvider()
      .then((nextProvider) => {
        if (active) setProvider(nextProvider as EIP1193Provider);
      })
      .catch(() => {
        if (active) setProvider(null);
      });

    return () => { active = false; };
  }, [account.connector, account.isConnected]);

  useEffect(() => {
    if (account.isConnected) setLoginOpen(false);
  }, [account.isConnected]);

  useEffect(() => {
    if (authStep === 'authenticated') setLoginOpen(false);
  }, [authStep]);

  const wallet: Wallet = {
    connected: account.isConnected,
    address: account.address ?? null,
    short: account.address ? shortAddr(account.address) : null,
    kind: account.isConnected || hasZeroDev ? 'zerodev' : 'none',
    mock: false,
    provider,
    async connect() {
      if (!hasZeroDev) {
        throw new Error('ZeroDev is not configured. Set NEXT_PUBLIC_ZERODEV_PROJECT_ID.');
      }

      const connector = connectors.find((candidate) => candidate.id === 'zerodev-wallet');
      if (!connector) throw new Error('The ZeroDev wallet connector is unavailable.');

      setLoginOpen(true);
      try {
        await connectAsync({ connector, chainId: 46630 });
      } finally {
        setLoginOpen(false);
      }
    },
    async disconnect() {
      await disconnectAsync();
      setProvider(null);
    },
  };

  return (
    <WalletContext.Provider value={wallet}>
      {children}
      <div
        className={loginOpen ? 'wallet-modal wallet-modal--open' : 'wallet-modal'}
        aria-hidden={!loginOpen}
      >
        <div className="wallet-modal__backdrop" aria-hidden="true" />
        <div className="wallet-modal__content" role="dialog" aria-modal="true" aria-label="Connect wallet">
          <ConnectWallet
            size="md"
            onClose={() => {
              if (recoveringMagicLink.current) {
                if (!account.isConnected) captureRecoveryFailure();
                closeRecovery();
              } else {
                setLoginOpen(false);
              }
            }}
          />
        </div>
      </div>
    </WalletContext.Provider>
  );
}
