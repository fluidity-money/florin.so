'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  http,
  parseUnits,
  zeroAddress,
  type Address,
  type Hash,
} from 'viem';
import { robinhoodTestnet } from '@reown/appkit/networks';
import { Button } from './ui';
import { RisksDialog } from './risks-dialog';
import { Token, TokenIcon } from './token-icon';
import { compact, money, pct, xnum } from '../lib/format';
import { AVG_RATE, queueAhead, RATE_BOOK_TOTAL } from '../lib/mockData';
import { useWallet } from './wallet/wallet';
import {
  borrowerOperationsAbi,
  CONTRACTS,
  erc20Abi,
  hintHelpersAbi,
  hintTrials,
  LIQUIDATOR_COMPENSATION_ETH,
  maxUpfrontFee,
  MIN_DEBT,
  priceFeedAbi,
  randomOwnerIndex,
  requiredSpyApproval,
  ROBINHOOD_TESTNET_CHAIN_ID,
  sortedTrovesAbi,
  validateOpenTrove,
} from '../lib/borrow-contract';

const publicClient = createPublicClient({ chain: robinhoodTestnet, transport: http() });
const MIN_RATE = 0.005;
const MAX_RATE = 0.25;
const DEFAULT_RATE = 0.06;
const MCR = 1.1;
const MAX_LTV = 1 / MCR;

type TxStage = 'idle' | 'switching' | 'approving' | 'opening' | 'confirming';

function parseToken(value: string): bigint {
  if (!value.trim()) return 0n;
  try {
    return parseUnits(value, 18);
  } catch {
    return 0n;
  }
}

function messageFrom(error: unknown): string {
  if (error instanceof Error) {
    const candidate = error as Error & { shortMessage?: string };
    return candidate.shortMessage ?? candidate.message;
  }
  return 'The wallet request failed.';
}

async function ensureRobinhoodTestnet(provider: NonNullable<ReturnType<typeof useWallet>['provider']>) {
  const current = await provider.request({ method: 'eth_chainId' });
  if (Number(current) === ROBINHOOD_TESTNET_CHAIN_ID) return;

  const chainId = `0x${ROBINHOOD_TESTNET_CHAIN_ID.toString(16)}`;
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 4902) throw error;
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

export function OpenPositionForm() {
  const wallet = useWallet();
  const account = wallet.address as Address | null;
  const [spyStr, setSpyStr] = useState('');
  const [debtStr, setDebtStr] = useState('');
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [stage, setStage] = useState<TxStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [minted, setMinted] = useState(false);

  const collateralWei = useMemo(() => parseToken(spyStr), [spyStr]);
  const borrowedWei = useMemo(() => parseToken(debtStr), [debtStr]);
  const rateWei = BigInt(Math.round(rate * 1e18));

  const chainState = useQuery({
    queryKey: ['open-trove-state', account],
    enabled: Boolean(account),
    refetchInterval: 15_000,
    queryFn: async () => {
      const [balance, allowance, price] = await Promise.all([
        publicClient.readContract({
          address: CONTRACTS.spyToken,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account!],
        }),
        publicClient.readContract({
          address: CONTRACTS.spyToken,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [account!, CONTRACTS.borrowerOperations],
        }),
        publicClient.readContract({
          address: CONTRACTS.spyPriceFeed,
          abi: priceFeedAbi,
          functionName: 'lastGoodPrice',
        }),
      ]);
      return { balance, allowance, price };
    },
  });

  const upfrontFee = useQuery({
    queryKey: ['open-trove-fee', borrowedWei.toString(), rateWei.toString()],
    enabled: borrowedWei >= MIN_DEBT,
    queryFn: () => publicClient.readContract({
      address: CONTRACTS.hintHelpers,
      abi: hintHelpersAbi,
      functionName: 'predictOpenTroveUpfrontFee',
      args: [0n, borrowedWei, rateWei],
    }),
  });

  const chainReady = Boolean(chainState.data);
  const feeReady = borrowedWei < MIN_DEBT || upfrontFee.data !== undefined;
  const spyPrice = chainState.data ? Number(formatUnits(chainState.data.price, 18)) : 0;
  const spy = Math.max(0, xnum(spyStr));
  const borrow = Math.max(0, xnum(debtStr));
  const fee = Number(formatUnits(upfrontFee.data ?? 0n, 18));
  const totalDebt = borrow + fee;
  const collateralUsd = spy * spyPrice;
  const collateralRatio = totalDebt > 0 ? collateralUsd / totalDebt : 0;
  const ltv = collateralUsd > 0 ? totalDebt / collateralUsd : 0;
  const maxBorrow = collateralUsd / MCR;
  const liquidationPrice = spy > 0 && totalDebt > 0 ? MCR * totalDebt / spy : 0;
  const annualInterest = totalDebt * rate;
  const ahead = queueAhead(rate) * RATE_BOOK_TOTAL;
  const redemptionRisk = rate >= AVG_RATE ? 'low' : rate >= AVG_RATE * 0.6 ? 'medium' : 'high';
  const pending = stage !== 'idle';
  const walletBalance = chainState.data ? Number(formatUnits(chainState.data.balance, 18)) : 0;
  const protocolError = validateOpenTrove(collateralWei, borrowedWei, rateWei);
  const insufficientSpy = chainState.data
    ? chainState.data.balance < requiredSpyApproval(collateralWei)
    : false;
  const unsafe = totalDebt > 0 && collateralRatio < MCR;
  const active = collateralWei > 0n && borrowedWei > 0n;

  async function openTrove() {
    if (!wallet.connected || !account || !wallet.provider) {
      setError(null);
      try {
        await wallet.connect();
      } catch (cause) {
        setError(messageFrom(cause));
      }
      return;
    }
    if (pending || protocolError || unsafe || insufficientSpy) return;

    setError(null);
    setTxHash(null);
    try {
      setStage('switching');
      await ensureRobinhoodTestnet(wallet.provider);
      const walletClient = createWalletClient({
        account,
        chain: robinhoodTestnet,
        transport: custom(wallet.provider),
      });

      const requiredApproval = requiredSpyApproval(collateralWei);
      const [balance, allowance, predictedFee, troveCount] = await Promise.all([
        publicClient.readContract({
          address: CONTRACTS.spyToken,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account],
        }),
        publicClient.readContract({
          address: CONTRACTS.spyToken,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [account, CONTRACTS.borrowerOperations],
        }),
        publicClient.readContract({
          address: CONTRACTS.hintHelpers,
          abi: hintHelpersAbi,
          functionName: 'predictOpenTroveUpfrontFee',
          args: [0n, borrowedWei, rateWei],
        }),
        publicClient.readContract({
          address: CONTRACTS.sortedTroves,
          abi: sortedTrovesAbi,
          functionName: 'size',
        }),
      ]);

      if (balance < requiredApproval) {
        throw new Error(`You need ${formatUnits(requiredApproval, 18)} SPY for this position.`);
      }

      let upperHint = 0n;
      let lowerHint = 0n;
      if (troveCount > 0n) {
        const [approxHint] = await publicClient.readContract({
          address: CONTRACTS.hintHelpers,
          abi: hintHelpersAbi,
          functionName: 'getApproxHint',
          args: [0n, rateWei, hintTrials(troveCount), BigInt(Date.now())],
        });
        [upperHint, lowerHint] = await publicClient.readContract({
          address: CONTRACTS.sortedTroves,
          abi: sortedTrovesAbi,
          functionName: 'findInsertPosition',
          args: [rateWei, approxHint, approxHint],
        });
      }

      if (allowance < requiredApproval) {
        setStage('approving');
        const approval = await publicClient.simulateContract({
          account,
          address: CONTRACTS.spyToken,
          abi: erc20Abi,
          functionName: 'approve',
          args: [CONTRACTS.borrowerOperations, requiredApproval],
        });
        const approvalHash = await walletClient.writeContract(approval.request);
        setTxHash(approvalHash);
        setStage('confirming');
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: approvalHash,
          onReplaced: (replacement) => setTxHash(replacement.transaction.hash),
        });
        if (receipt.status !== 'success') throw new Error('The SPY approval transaction reverted.');
      }

      setStage('opening');
      const ownerIndex = randomOwnerIndex();
      const simulation = await publicClient.simulateContract({
        account,
        address: CONTRACTS.borrowerOperations,
        abi: borrowerOperationsAbi,
        functionName: 'openTrove',
        value: LIQUIDATOR_COMPENSATION_ETH,
        args: [
          account,
          ownerIndex,
          collateralWei,
          borrowedWei,
          upperHint,
          lowerHint,
          rateWei,
          maxUpfrontFee(predictedFee),
          zeroAddress,
          zeroAddress,
          zeroAddress,
        ],
      });
      const hash = await walletClient.writeContract(simulation.request);
      setTxHash(hash);
      setStage('confirming');
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        onReplaced: (replacement) => setTxHash(replacement.transaction.hash),
      });
      if (receipt.status !== 'success') throw new Error('The open-trove transaction reverted.');

      await chainState.refetch();
      setMinted(true);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setStage('idle');
    }
  }

  if (minted && txHash) {
    return (
      <div className="swap">
        <div className="swap__done">
          <span className="swap__done-mark" aria-hidden="true">✓</span>
          <h2>FUSD minted</h2>
          <p>{money(borrow, 2)} FUSD was minted against {money(spy, 4)} SPY.</p>
          <a
            className="btn btn--primary"
            href={`${robinhoodTestnet.blockExplorers.default.url}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            View transaction ↗
          </a>
        </div>
      </div>
    );
  }

  const buttonLabel = !wallet.connected
    ? 'Connect wallet to continue'
    : stage === 'switching'
      ? 'Switching network…'
      : stage === 'approving'
        ? 'Approve SPY in wallet…'
        : stage === 'opening'
          ? 'Confirm position in wallet…'
          : stage === 'confirming'
            ? 'Waiting for confirmation…'
            : 'Mint FUSD →';

  return (
    <div className="swap">
      <h1 className="swap__title">
        <span>Borrow</span>
        <span className="swap__pair"><TokenIcon symbol="FUSD" size={30} /><span className="swap__tok">FUSD</span></span>
        <span>with</span>
        <span className="swap__pair"><TokenIcon symbol="SPY" size={30} /><span className="swap__tok">SPY</span></span>
      </h1>

      <div className="swap__field">
        <span className="swap__label">Collateral</span>
        <div className="swap__row">
          <input className="swap__amount" inputMode="decimal" placeholder="0.00" value={spyStr}
            onChange={(event) => setSpyStr(event.target.value)} aria-label="SPY collateral" />
          <span className="swap__pill"><Token symbol="SPY" size={18} /></span>
        </div>
        <span className="swap__usd">
          ${money(collateralUsd)} · wallet {wallet.connected ? `${money(walletBalance, 4)} SPY` : 'not connected'}
        </span>
      </div>
      <div className="swap__meta">
        <span>
          Oracle price <b>{chainReady ? `$${money(spyPrice)}` : 'loading…'}</b>{' '}
          {chainReady && <><i className="swap__dot swap__dot--ok" /> onchain</>}
        </span>
        <span>Max LTV <b>{pct(MAX_LTV * 100, 1)}</b></span>
      </div>

      <div className="swap__field">
        <span className="swap__label">Loan</span>
        <div className="swap__row">
          <input className="swap__amount" inputMode="decimal" placeholder="10.00" value={debtStr}
            onChange={(event) => setDebtStr(event.target.value.replaceAll(',', ''))} aria-label="FUSD to borrow" />
          <button
            type="button"
            className="swap__max"
            disabled={maxBorrow <= 0}
            onClick={() => setDebtStr(maxBorrow > 0 ? maxBorrow.toFixed(2) : '')}
          >
            Max
          </button>
          <span className="swap__pill"><Token symbol="FUSD" size={18} /></span>
        </div>
        <span className="swap__usd">
          ${money(borrow)} received{fee > 0 ? ` · ${money(totalDebt)} debt including ${money(fee)} upfront interest` : ''}
        </span>
      </div>
      <div className="swap__meta">
        <span><i className={`swap__dot swap__dot--${unsafe ? 'liquidation' : collateralRatio < 1.3 && active ? 'warning' : 'healthy'}`} /> Liquidation risk</span>
        <span>Approx. max borrow <b>{spy > 0 ? `$${money(maxBorrow, 2)}` : '−'}</b></span>
      </div>
      <div className="swap__meta swap__meta--right">
        <span>Liquidation price <b>{active ? `$${money(liquidationPrice)}` : '−'}</b></span>
      </div>
      <div className="swap__meta swap__meta--right">
        <span>LTV <b>{active ? pct(ltv * 100, 1) : '−'}</b>{active && <em> ({pct(collateralRatio * 100, 0)} CR)</em>}</span>
      </div>

      <div className="swap__field swap__field--rate">
        <div className="swap__row"><span className="swap__label">Set annual interest rate</span></div>
        <div className="swap__row">
          <span className="swap__amount swap__amount--rate">{pct(rate * 100, 2)}</span>
          <input className="slider swap__slider" type="range" min={MIN_RATE} max={MAX_RATE} step={0.0025}
            value={rate} onChange={(event) => setRate(parseFloat(event.target.value))} aria-label="Interest rate" />
        </div>
        <span className="swap__usd">${money(annualInterest)} FUSD / year</span>
      </div>
      <div className="swap__meta">
        <span><i className={`swap__dot swap__dot--${redemptionRisk}`} /> {redemptionRisk} redemption risk</span>
        <span>Redeemable before you <b>{compact(ahead)}</b></span>
      </div>

      <details className="swap__note">
        <summary>What happens when you open a position?</summary>
        <p>Your wallet first approves exactly the SPY needed for this position. A second transaction deposits the SPY, sends a 0.0375 ETH liquidator-compensation deposit, and mints FUSD.</p>
        <p>Your interest rate also determines your place in the redemption queue: lower-rate positions are redeemed first.</p>
      </details>

      {protocolError && active && <p className="warn">{protocolError}</p>}
      {unsafe && <p className="warn">This position is below the protocol&apos;s 110% minimum collateral ratio.</p>}
      {insufficientSpy && <p className="warn">Your wallet does not have enough testnet SPY for the collateral.</p>}
      {chainState.isError && <p className="warn">Could not read the Robinhood testnet contracts. Try again before submitting.</p>}
      {upfrontFee.isError && <p className="warn">Could not quote the onchain upfront fee. Try again before submitting.</p>}
      {error && <p className="warn" role="alert">{error}</p>}
      {txHash && pending && (
        <p className="swap__usd">
          <a href={`${robinhoodTestnet.blockExplorers.default.url}/tx/${txHash}`} target="_blank" rel="noreferrer">View pending transaction ↗</a>
        </p>
      )}

      <Button
        variant="primary"
        disabled={wallet.connected && (!active || Boolean(protocolError) || unsafe || insufficientSpy || pending || !chainReady || !feeReady || chainState.isError || upfrontFee.isError)}
        onClick={() => void openTrove()}
      >
        {buttonLabel}
      </Button>

      <RisksDialog />
    </div>
  );
}
