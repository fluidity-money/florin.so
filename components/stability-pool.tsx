'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { robinhoodTestnet } from 'viem/chains';
import {
  createWalletClient,
  custom,
  formatUnits,
  parseUnits,
  type Address,
  type Hash,
} from 'viem';
import { Button } from './ui';
import { RisksDialog } from './risks-dialog';
import { Token, TokenIcon } from './token-icon';
import { parseDisplayPercent, spyMarket, type FlorinMarkets } from '../lib/florin-markets';
import { money } from '../lib/format';
import { MIN_COLLATERAL_RATIO } from '../lib/protocol-constants';
import { useWallet } from './wallet/wallet';
import { useFlorinMarkets } from '../lib/use-florin-markets';
import { robinhoodPublicClient } from '../lib/robinhood-client';
import { captureEvent } from '../lib/analytics';
import {
  CONTRACTS,
  erc20Abi,
  MIN_FUSD_IN_STABILITY_POOL,
  ROBINHOOD_TESTNET_CHAIN_ID,
  stabilityPoolAbi,
  validateStabilityPoolAmount,
} from '../lib/borrow-contract';

type Mode = 'deposit' | 'withdraw';
type TxStage = 'idle' | 'switching' | 'approving' | 'submitting' | 'confirming';

function parseToken(value: string): bigint {
  if (!value.trim()) return 0n;
  try {
    return parseUnits(value, 18);
  } catch {
    return 0n;
  }
}

function errorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error || 'Unknown wallet or network error.');
  const candidate = error as { shortMessage?: unknown; details?: unknown; message?: unknown; cause?: unknown };
  for (const value of [candidate.shortMessage, candidate.details, candidate.message]) {
    if (typeof value === 'string' && value.trim()) return value.replace(/\s+/g, ' ').trim();
  }
  return candidate.cause ? errorMessage(candidate.cause) : 'Unknown wallet or network error.';
}

async function ensureRobinhoodTestnet(provider: NonNullable<ReturnType<typeof useWallet>['provider']>) {
  const current = await provider.request({ method: 'eth_chainId' });
  if (Number(current) === ROBINHOOD_TESTNET_CHAIN_ID) return;

  const chainId = `0x${ROBINHOOD_TESTNET_CHAIN_ID.toString(16)}`;
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId,
        chainName: robinhoodTestnet.name,
        nativeCurrency: robinhoodTestnet.nativeCurrency,
        rpcUrls: [...robinhoodTestnet.rpcUrls.default.http],
        blockExplorerUrls: [robinhoodTestnet.blockExplorers.default.url],
      }],
    });
  }
}

function Seg({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <span className="seg" role="group" aria-label="Stability Pool action">
      {(['deposit', 'withdraw'] as const).map((option) => (
        <button
          key={option}
          type="button"
          className={mode === option ? 'seg__opt seg__opt--on' : 'seg__opt'}
          aria-pressed={mode === option}
          onClick={() => onChange(option)}
        >
          {option === 'deposit' ? 'Deposit' : 'Withdraw'}
        </button>
      ))}
    </span>
  );
}

export function StabilityPool({ initialMarkets }: { initialMarkets: FlorinMarkets }) {
  const wallet = useWallet();
  const account = wallet.address as Address | null;
  const markets = useFlorinMarkets(initialMarkets);
  const { earn: rewards } = spyMarket(markets);
  const [mode, setMode] = useState<Mode>('deposit');
  const [amountStr, setAmountStr] = useState('');
  const [stage, setStage] = useState<TxStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hash | null>(null);

  const position = useQuery({
    queryKey: ['stability-pool-position', account],
    enabled: Boolean(account),
    refetchInterval: 15_000,
    queryFn: async () => {
      const [walletBalance, deposit, totalDeposits, collGain, yieldGain, stashedColl] = await Promise.all([
        robinhoodPublicClient.readContract({
          address: CONTRACTS.boldToken,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account!],
        }),
        robinhoodPublicClient.readContract({
          address: CONTRACTS.stabilityPool,
          abi: stabilityPoolAbi,
          functionName: 'getCompoundedBoldDeposit',
          args: [account!],
        }),
        robinhoodPublicClient.readContract({
          address: CONTRACTS.stabilityPool,
          abi: stabilityPoolAbi,
          functionName: 'getTotalBoldDeposits',
        }),
        robinhoodPublicClient.readContract({
          address: CONTRACTS.stabilityPool,
          abi: stabilityPoolAbi,
          functionName: 'getDepositorCollGain',
          args: [account!],
        }),
        robinhoodPublicClient.readContract({
          address: CONTRACTS.stabilityPool,
          abi: stabilityPoolAbi,
          functionName: 'getDepositorYieldGainWithPending',
          args: [account!],
        }),
        robinhoodPublicClient.readContract({
          address: CONTRACTS.stabilityPool,
          abi: stabilityPoolAbi,
          functionName: 'stashedColl',
          args: [account!],
        }),
      ]);
      return { walletBalance, deposit, totalDeposits, collGain, yieldGain, stashedColl };
    },
  });

  const amount = useMemo(() => parseToken(amountStr), [amountStr]);
  const available = mode === 'deposit'
    ? position.data?.walletBalance ?? 0n
    : position.data?.deposit ?? 0n;
  const totalDeposits = position.data?.totalDeposits ?? 0n;
  const withdrawableFromPool = totalDeposits > MIN_FUSD_IN_STABILITY_POOL
    ? totalDeposits - MIN_FUSD_IN_STABILITY_POOL
    : 0n;
  const maxAmount = mode === 'deposit'
    ? available
    : available < withdrawableFromPool ? available : withdrawableFromPool;
  const validationError = validateStabilityPoolAmount(mode, amount, available, totalDeposits);
  const pending = stage !== 'idle';
  const deposit = position.data?.deposit ?? 0n;
  const fusdReward = position.data?.yieldGain ?? 0n;
  const spyReward = (position.data?.collGain ?? 0n) + (position.data?.stashedColl ?? 0n);
  const hasRewards = fusdReward > 0n || spyReward > 0n;
  const coverage = parseDisplayPercent(rewards?.coverage);
  const coverageRisk = coverage === null
    ? 'high'
    : coverage >= 0.5
      ? 'ok'
      : coverage >= 0.25
        ? 'medium'
        : 'high';

  async function waitForReceipt(hash: Hash): Promise<Hash> {
    let currentHash = hash;
    setTxHash(hash);
    setStage('confirming');
    const receipt = await robinhoodPublicClient.waitForTransactionReceipt({
      hash,
      onReplaced: (replacement) => {
        currentHash = replacement.transaction.hash;
        setTxHash(currentHash);
      },
    });
    if (receipt.status !== 'success') throw new Error('The transaction reverted.');
    return currentHash;
  }

  async function transact(action: Mode | 'claim') {
    if (!wallet.connected || !account || !wallet.provider) {
      setError(null);
      try {
        await wallet.connect();
      } catch (cause) {
        setError(errorMessage(cause));
      }
      return;
    }
    if (pending) return;

    captureEvent('stability_pool_action_requested', {
      action,
      chain_id: ROBINHOOD_TESTNET_CHAIN_ID,
      wallet_kind: wallet.kind,
      coverage_risk: coverageRisk,
    });
    setError(null);
    setSuccess(null);
    setTxHash(null);
    try {
      setStage('switching');
      await ensureRobinhoodTestnet(wallet.provider);
      const walletClient = createWalletClient({
        account,
        chain: robinhoodTestnet,
        transport: custom(wallet.provider),
      });

      if (action === 'deposit') {
        const [walletBalance, allowance, currentTotalDeposits] = await Promise.all([
          robinhoodPublicClient.readContract({
            address: CONTRACTS.boldToken,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [account],
          }),
          robinhoodPublicClient.readContract({
            address: CONTRACTS.boldToken,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [account, CONTRACTS.stabilityPool],
          }),
          robinhoodPublicClient.readContract({
            address: CONTRACTS.stabilityPool,
            abi: stabilityPoolAbi,
            functionName: 'getTotalBoldDeposits',
          }),
        ]);
        const invalid = validateStabilityPoolAmount(
          'deposit',
          amount,
          walletBalance,
          currentTotalDeposits,
        );
        if (invalid) throw new Error(invalid);

        if (allowance < amount) {
          setStage('approving');
          const approval = await robinhoodPublicClient.simulateContract({
            account,
            address: CONTRACTS.boldToken,
            abi: erc20Abi,
            functionName: 'approve',
            args: [CONTRACTS.stabilityPool, amount],
          });
          await waitForReceipt(await walletClient.writeContract(approval.request));
        }

        setTxHash(null);
        setStage('submitting');
        const simulation = await robinhoodPublicClient.simulateContract({
          account,
          address: CONTRACTS.stabilityPool,
          abi: stabilityPoolAbi,
          functionName: 'provideToSP',
          args: [amount, false],
        });
        await waitForReceipt(await walletClient.writeContract(simulation.request));
        setSuccess(`${money(Number(formatUnits(amount, 18)), 2)} FUSD deposited.`);
      } else if (action === 'withdraw') {
        const [currentDeposit, currentTotalDeposits] = await Promise.all([
          robinhoodPublicClient.readContract({
            address: CONTRACTS.stabilityPool,
            abi: stabilityPoolAbi,
            functionName: 'getCompoundedBoldDeposit',
            args: [account],
          }),
          robinhoodPublicClient.readContract({
            address: CONTRACTS.stabilityPool,
            abi: stabilityPoolAbi,
            functionName: 'getTotalBoldDeposits',
          }),
        ]);
        const invalid = validateStabilityPoolAmount(
          'withdraw',
          amount,
          currentDeposit,
          currentTotalDeposits,
        );
        if (invalid) throw new Error(invalid);

        setStage('submitting');
        const simulation = await robinhoodPublicClient.simulateContract({
          account,
          address: CONTRACTS.stabilityPool,
          abi: stabilityPoolAbi,
          functionName: 'withdrawFromSP',
          args: [amount, false],
        });
        await waitForReceipt(await walletClient.writeContract(simulation.request));
        setSuccess(`${money(Number(formatUnits(amount, 18)), 2)} FUSD withdrawn.`);
      } else {
        const initialDeposit = await robinhoodPublicClient.readContract({
          address: CONTRACTS.stabilityPool,
          abi: stabilityPoolAbi,
          functionName: 'deposits',
          args: [account],
        });
        setStage('submitting');
        if (initialDeposit > 0n) {
          const simulation = await robinhoodPublicClient.simulateContract({
            account,
            address: CONTRACTS.stabilityPool,
            abi: stabilityPoolAbi,
            functionName: 'withdrawFromSP',
            args: [0n, true],
          });
          await waitForReceipt(await walletClient.writeContract(simulation.request));
        } else {
          const simulation = await robinhoodPublicClient.simulateContract({
            account,
            address: CONTRACTS.stabilityPool,
            abi: stabilityPoolAbi,
            functionName: 'claimAllCollGains',
          });
          await waitForReceipt(await walletClient.writeContract(simulation.request));
        }
        setSuccess('Stability Pool rewards claimed.');
      }

      captureEvent('stability_pool_action_succeeded', {
        action,
        chain_id: ROBINHOOD_TESTNET_CHAIN_ID,
        wallet_kind: wallet.kind,
        coverage_risk: coverageRisk,
      });
      setAmountStr('');
      await position.refetch();
    } catch (cause) {
      setError(errorMessage(cause));
      captureEvent('stability_pool_action_failed', {
        action,
        chain_id: ROBINHOOD_TESTNET_CHAIN_ID,
        wallet_kind: wallet.kind,
        coverage_risk: coverageRisk,
      });
    } finally {
      setStage('idle');
    }
  }

  const availableDisplay = Number(formatUnits(available, 18));
  const buttonLabel = !wallet.connected
    ? 'Connect wallet to continue'
    : stage === 'switching'
      ? 'Switching network…'
      : stage === 'approving'
        ? 'Approve FUSD in wallet…'
        : stage === 'submitting'
          ? 'Confirm in wallet…'
          : stage === 'confirming'
            ? 'Waiting for confirmation…'
            : mode === 'deposit'
              ? 'Deposit FUSD →'
              : 'Withdraw FUSD →';

  return (
    <div className="swap">
      <h1 className="swap__title">
        <span>Deposit</span>
        <span className="swap__pair">
          <TokenIcon symbol="FUSD" size={30} />
          <span className="swap__tok">FUSD</span>
        </span>
        <span>to earn rewards</span>
      </h1>
      <p className="swap__sub">
        A FUSD deposit earns a share of the interest every borrower pays. It
        also settles liquidations: when a position goes under, your FUSD is
        burned and you are handed the seized SPY at a discount.
      </p>

      <div className="pool">
        <div className="pool__head">
          <div className="pool__ident">
            <TokenIcon symbol="SPY" size={30} />
            <span>
              <span className="pool__name">SPY Stability Pool</span>
              <span className="pool__tvl">TVL <b>{rewards?.poolSize ?? '—'}</b> FUSD</span>
            </span>
          </div>
          <div className="pool__aprs">
            <span>APR <b>{rewards?.apr ?? '—'}</b></span>
            <span className="pool__apr-sub">
              <i className={`swap__dot swap__dot--${coverageRisk}`} />
              covers {rewards?.coverage ?? '—'} of FUSD supply
            </span>
          </div>
        </div>
        <div className="pool__foot">
          <span className="tok-row">Deposit <Token symbol="FUSD" size={16} /></span>
          <span className="tok-row">Rewards <Token symbol="FUSD" size={16} /> <Token symbol="SPY" size={16} /></span>
        </div>
      </div>

      <div className="pool">
        <div className="pool__head">
          <div className="pool__ident">
            <TokenIcon symbol="FUSD" size={30} />
            <span>
              <span className="pool__name">Your pool position</span>
              <span className="pool__tvl">
                Deposited <b>{wallet.connected ? money(Number(formatUnits(deposit, 18)), 2) : '—'}</b> FUSD
              </span>
            </span>
          </div>
          <div className="pool__aprs">
            <span>FUSD rewards <b>{wallet.connected ? money(Number(formatUnits(fusdReward, 18)), 4) : '—'}</b></span>
            <span className="pool__apr-sub">SPY rewards {wallet.connected ? money(Number(formatUnits(spyReward, 18)), 6) : '—'}</span>
          </div>
        </div>
        {wallet.connected && position.isError && <p className="warn">Could not load your onchain pool position.</p>}
      </div>

      <div className="swap__field">
        <div className="swap__row">
          <span className="swap__label">Amount</span>
          <Seg mode={mode} onChange={(next) => {
            captureEvent('transaction_mode_changed', { context: 'stability_pool', mode: next });
            setMode(next);
            setAmountStr('');
            setError(null);
            setSuccess(null);
          }} />
        </div>
        <div className="swap__row">
          <input
            className="swap__amount"
            inputMode="decimal"
            placeholder="0.00"
            value={amountStr}
            onChange={(event) => setAmountStr(event.target.value)}
            aria-label={`FUSD to ${mode}`}
          />
          <button
            type="button"
            className="swap__max"
            disabled={maxAmount <= 0n}
            onClick={() => {
              captureEvent('max_amount_selected', { context: 'stability_pool', action: mode, asset: 'FUSD' });
              setAmountStr(formatUnits(maxAmount, 18));
            }}
          >
            Max
          </button>
          <span className="swap__pill"><Token symbol="FUSD" size={18} /></span>
        </div>
        <span className="swap__usd">
          {wallet.connected
            ? mode === 'deposit'
              ? `${money(availableDisplay, 2)} FUSD in wallet`
              : `${money(availableDisplay, 4)} FUSD deposited`
            : 'Connect a wallet to view your balance'}
        </span>
      </div>

      {amountStr.trim() && validationError && <p className="swap__over">{validationError}</p>}
      <details className="swap__note">
        <summary>What the pool actually does</summary>
        <p>
          It clears positions that fall below {Math.round(MIN_COLLATERAL_RATIO * 100)}%. The
          pool burns the trove&apos;s debt and receives its collateral, and the
          difference is your compensation for absorbing it.
        </p>
        <p>
          FUSD rewards compound in the pool until you claim them. SPY earned from liquidations
          is held for you until you claim rewards.
        </p>
      </details>

      {error && (
        <div className="swap__error" role="alert">
          <p className="warn">Transaction failed.</p>
          <p className="swap__error-explanation">{error}</p>
        </div>
      )}
      {success && <p className="swap__success" role="status">{success}</p>}
      {txHash && (
        <p className="swap__usd">
          <a href={`${robinhoodTestnet.blockExplorers.default.url}/tx/${txHash}`} target="_blank" rel="noreferrer">
            {pending ? 'View pending transaction ↗' : 'View transaction ↗'}
          </a>
        </p>
      )}

      <Button
        variant="primary"
        disabled={wallet.connected && (pending || position.isLoading || position.isError || Boolean(validationError))}
        onClick={() => void transact(mode)}
      >
        {buttonLabel}
      </Button>
      {wallet.connected && hasRewards && (
        <Button variant="ghost" disabled={pending} onClick={() => void transact('claim')}>
          Claim rewards · {money(Number(formatUnits(fusdReward, 18)), 4)} FUSD + {money(Number(formatUnits(spyReward, 18)), 6)} SPY
        </Button>
      )}

      <RisksDialog label="A deposit can be converted to SPY" />
    </div>
  );
}
