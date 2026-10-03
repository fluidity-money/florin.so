'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  createWalletClient,
  custom,
  formatUnits,
  parseUnits,
  zeroAddress,
  type Address,
  type Hash,
} from 'viem';
import { robinhoodTestnet } from '@reown/appkit/networks';
import { Button, RatioBar } from './ui';
import { RisksDialog } from './risks-dialog';
import { Token, TokenIcon } from './token-icon';
import { money, pct, xnum } from '../lib/format';
import { useWallet } from './wallet/wallet';
import { useOpenPositions } from '../lib/use-open-positions';
import type { FlorinPosition } from '../lib/florin-positions';
import { positionMetrics } from '../lib/protocol-math';
import { MAX_RATE, MIN_COLLATERAL_RATIO, MIN_RATE } from '../lib/protocol-constants';
import { parseDisplayPercent, spyMarket, type FlorinMarkets } from '../lib/florin-markets';
import { useFlorinMarkets } from '../lib/use-florin-markets';
import {
  annualRateFromDisplayPercent,
  borrowerOperationsAbi,
  CONTRACTS,
  erc20Abi,
  hintHelpersAbi,
  hintTrials,
  maxBorrowPrincipal,
  maxRepayableDebt,
  maxUpfrontFee,
  priceFeedAbi,
  ROBINHOOD_TESTNET_CHAIN_ID,
  sortedTrovesAbi,
  validatePositionAmount,
  validatedOraclePrice,
} from '../lib/borrow-contract';
import { robinhoodPublicClient } from '../lib/robinhood-client';
import { captureEvent } from '../lib/analytics';
import {
  describeTransactionError,
  type TransactionErrorDescription,
  type TransactionFailureStage,
} from '../lib/transaction-error';

type CollMode = 'deposit' | 'withdraw';
type DebtMode = 'borrow' | 'repay';
type TxAction = CollMode | DebtMode | 'rate' | 'close';
type TxStage = 'idle' | 'switching' | 'approving' | 'submitting' | 'confirming';

function parseToken(value: string): bigint {
  if (!value.trim()) return 0n;
  try {
    return parseUnits(value, 18);
  } catch {
    return 0n;
  }
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

function Seg<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <span className="seg" role="group">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={o.id === value ? 'seg__opt seg__opt--on' : 'seg__opt'}
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

function PositionNotice({
  title,
  children,
  retry,
}: {
  title: string;
  children: React.ReactNode;
  retry?: () => void;
}) {
  return (
    <div className="swap">
      <h1 className="swap__title"><span>Your position</span></h1>
      <div className="swap__done">
        <span className="swap__done-mark" aria-hidden="true">○</span>
        <h2>{title}</h2>
        <p>{children}</p>
        {retry ? (
          <Button variant="primary" onClick={retry}>Try again</Button>
        ) : title === 'No position found' ? (
          <a className="btn btn--primary" href="/open">Open position →</a>
        ) : null}
      </div>
    </div>
  );
}

export function ManagePosition({ initialMarkets }: { initialMarkets: FlorinMarkets }) {
  const w = useWallet();
  const markets = useFlorinMarkets(initialMarkets);
  const { borrow: spyMarketDetails } = spyMarket(markets);
  const marketAverageRate = parseDisplayPercent(spyMarketDetails?.avgRatePa);
  const { status, positions, error, refresh } = useOpenPositions(w.address);
  const [selectedTroveId, setSelectedTroveId] = useState<string | null>(null);

  if (!w.connected || !w.address) {
    return (
      <PositionNotice title="No position found">
        Connect a wallet to view and manage its positions.
      </PositionNotice>
    );
  }
  if (status === 'idle' || status === 'loading') {
    return <PositionNotice title="Loading position">Looking up this wallet’s open positions…</PositionNotice>;
  }
  if (status === 'error') {
    return (
      <PositionNotice title="Unable to load position" retry={refresh}>
        Florin GraphQL could not load this wallet’s positions{error ? `: ${error}` : '.'}
      </PositionNotice>
    );
  }
  if (positions.length === 0) {
    return (
      <PositionNotice title="No position found">
        This address does not have an open Florin position.
      </PositionNotice>
    );
  }

  const position = positions.find(({ troveId }) => troveId === selectedTroveId) ?? positions[0];
  return (
    <PositionEditor
      key={position.troveId}
      position={position}
      positions={positions}
      onSelect={setSelectedTroveId}
      onChanged={refresh}
      marketAverageRate={marketAverageRate}
    />
  );
}

// A trove id is a uint256, which the graph hands over as 77 decimal digits.
// Printed in full, two of them read as the same number with a different tail.
// Hex is both shorter and the form the explorer uses, so a holder can still
// match what they see here against the chain.
function shortTroveId(troveId: string): string {
  try {
    const hex = BigInt(troveId).toString(16).padStart(64, '0');
    return `0x${hex.slice(0, 4)}…${hex.slice(-4)}`;
  } catch {
    return `#${troveId.slice(0, 6)}…`;
  }
}

// One position, as a line: what is in it, what it owes, how close it is to the
// floor. The id comes last because it is the thing a holder needs least often,
// and size and health are what actually tell two positions apart.
function PositionLine({
  position,
  spyPrice,
  priceReady,
}: {
  position: FlorinPosition;
  spyPrice: number;
  priceReady: boolean;
}) {
  const metrics = positionMetrics(position.collateralSPY, position.debtFUSD, spyPrice);
  const ltv = metrics.collateralUsd > 0 ? position.debtFUSD / metrics.collateralUsd : 0;

  return (
    <span className="picker__line">
      <TokenIcon symbol="SPY" size={24} />
      <span className="picker__facts">
        <span className="picker__main">
          {money(position.collateralSPY, 2)} SPY
          <em>${money(position.debtFUSD)} debt</em>
        </span>
        <span className="picker__sub">
          {priceReady ? (
            <span className="picker__health">
              <i className={`swap__dot swap__dot--${metrics.health}`} />
              LTV {pct(ltv * 100, 1)}
            </span>
          ) : (
            <span className="picker__health">oracle unavailable</span>
          )}
          <em>{shortTroveId(position.troveId)}</em>
        </span>
      </span>
    </span>
  );
}

// Replaces a native <select>, which could only ever render one line of text per
// position and so had to lead with the id.
function PositionPicker({
  positions,
  selected,
  spyPrice,
  priceReady,
  onSelect,
}: {
  positions: FlorinPosition[];
  selected: FlorinPosition;
  spyPrice: number;
  priceReady: boolean;
  onSelect: (troveId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // A pointer outside the picker, or Escape, closes it. Both listeners only
  // exist while it is open.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function step(delta: number) {
    const at = positions.findIndex(({ troveId }) => troveId === selected.troveId);
    const next = positions[(at + delta + positions.length) % positions.length];
    if (next) onSelect(next.troveId);
  }

  return (
    <div className="picker" ref={root}>
      <button
        type="button"
        className="picker__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          if (!open) {
            setOpen(true);
            return;
          }
          step(event.key === 'ArrowDown' ? 1 : -1);
        }}
      >
        <PositionLine position={selected} spyPrice={spyPrice} priceReady={priceReady} />
        <span className="picker__chev" aria-hidden="true" />
      </button>

      {open && (
        <ul className="picker__menu" role="listbox" aria-label="Your open positions">
          {positions.map((candidate) => {
            const current = candidate.troveId === selected.troveId;
            return (
              <li key={candidate.troveId}>
                <button
                  type="button"
                  role="option"
                  aria-selected={current}
                  className={current ? 'picker__opt picker__opt--on' : 'picker__opt'}
                  onClick={() => {
                    onSelect(candidate.troveId);
                    setOpen(false);
                  }}
                >
                  <PositionLine position={candidate} spyPrice={spyPrice} priceReady={priceReady} />
                  {current && <span className="picker__tick" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PositionEditor({
  position,
  positions,
  onSelect,
  onChanged,
  marketAverageRate,
}: {
  position: FlorinPosition;
  positions: FlorinPosition[];
  onSelect: (troveId: string) => void;
  onChanged: () => void;
  marketAverageRate: number | null;
}) {
  const w = useWallet();
  const account = w.address as Address | null;
  const collateral = position.collateralSPY;
  const debt = position.debtFUSD;
  const [rate, setRate] = useState(position.rate);

  const [collMode, setCollMode] = useState<CollMode>('deposit');
  const [debtMode, setDebtMode] = useState<DebtMode>('repay');
  const [collStr, setCollStr] = useState('');
  const [debtStr, setDebtStr] = useState('');
  const [stage, setStage] = useState<TxStage>('idle');
  const [txAction, setTxAction] = useState<TxAction | null>(null);
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [txComplete, setTxComplete] = useState(false);
  const [txError, setTxError] = useState<TransactionErrorDescription | null>(null);

  const collateralWei = useMemo(() => parseToken(collStr), [collStr]);
  const debtWei = useMemo(() => parseToken(debtStr), [debtStr]);
  const currentCollateralWei = BigInt(position.collateral);
  const currentDebtWei = BigInt(position.debt);
  const troveId = BigInt(position.troveId);
  const rateWei = parseUnits(rate.toString(), 18);
  const currentRateWei = annualRateFromDisplayPercent(position.annualInterestRate);
  const pendingTx = stage !== 'idle';
  const batched = Boolean(
    position.interestBatchManager
      && position.interestBatchManager.toLowerCase() !== zeroAddress,
  );

  const chainState = useQuery({
    queryKey: ['manage-position-state', account],
    enabled: Boolean(account),
    refetchInterval: 15_000,
    queryFn: async () => {
      const [spyBalance, fusdBalance, priceSimulation] = await Promise.all([
        robinhoodPublicClient.readContract({
          address: CONTRACTS.spyToken,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account!],
        }),
        robinhoodPublicClient.readContract({
          address: CONTRACTS.boldToken,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account!],
        }),
        robinhoodPublicClient.simulateContract({
          address: CONTRACTS.spyPriceFeed,
          abi: priceFeedAbi,
          functionName: 'fetchPrice',
        }),
      ]);
      return { spyBalance, fusdBalance, price: validatedOraclePrice(priceSimulation.result) };
    },
  });
  const priceReady = chainState.data !== undefined && chainState.data.price > 0n;
  const spyPrice = chainState.data ? Number(formatUnits(chainState.data.price, 18)) : 0;
  const spyBalanceWei = chainState.data?.spyBalance ?? 0n;
  const fusdBalanceWei = chainState.data?.fusdBalance ?? 0n;
  const spyBalance = Number(formatUnits(spyBalanceWei, 18));
  const fusdBalance = Number(formatUnits(fusdBalanceWei, 18));
  const debtCapacityWei = chainState.data
    ? (currentCollateralWei * chainState.data.price * 10n) / (10n ** 18n * 11n)
    : 0n;
  const debtRoomWei = debtCapacityWei > currentDebtWei ? debtCapacityWei - currentDebtWei : 0n;

  const borrowFee = useQuery({
    queryKey: ['adjust-trove-fee', position.troveId, debtWei.toString()],
    enabled: debtMode === 'borrow' && debtWei > 0n,
    queryFn: () => robinhoodPublicClient.readContract({
      address: CONTRACTS.hintHelpers,
      abi: hintHelpersAbi,
      functionName: 'predictAdjustTroveUpfrontFee',
      args: [0n, troveId, debtWei],
    }),
  });
  const maxBorrowFee = useQuery({
    queryKey: ['adjust-trove-max-fee', position.troveId, debtRoomWei.toString()],
    enabled: priceReady && debtRoomWei > 0n,
    queryFn: () => robinhoodPublicClient.readContract({
      address: CONTRACTS.hintHelpers,
      abi: hintHelpersAbi,
      functionName: 'predictAdjustTroveUpfrontFee',
      args: [0n, troveId, debtRoomWei],
    }),
  });
  const borrowFeeReady = debtMode !== 'borrow' || debtWei <= 0n || borrowFee.data !== undefined;
  const maxBorrowWei = maxBorrowFee.data === undefined
    ? 0n
    : maxBorrowPrincipal(debtCapacityWei, currentDebtWei, maxBorrowFee.data);

  const m = positionMetrics(collateral, debt, spyPrice);
  const freeUsd = priceReady ? Number(formatUnits(maxBorrowWei, 18)) : 0;
  const ltv = m.collateralUsd > 0 ? debt / m.collateralUsd : 0;

  const collAmt = Math.max(0, xnum(collStr));
  const debtAmt = Math.max(0, xnum(debtStr));
  const borrowFeeAmount = Number(formatUnits(borrowFee.data ?? 0n, 18));

  // What the position becomes if this change is applied. Showing it beside the
  // current figure is the whole point of a manage screen: the question is never
  // "what is my ratio" but "what will it be if I do this".
  const nextCollateral =
    collMode === 'deposit' ? collateral + collAmt : Math.max(0, collateral - collAmt);
  const nextDebt = debtMode === 'borrow'
    ? debt + debtAmt + borrowFeeAmount
    : Math.max(0, debt - debtAmt);
  const preview = positionMetrics(nextCollateral, nextDebt, spyPrice);
  const pending = collAmt > 0 || debtAmt > 0;

  const collMaxWei = collMode === 'deposit' ? spyBalanceWei : currentCollateralWei;
  const repayableDebtWei = maxRepayableDebt(currentDebtWei);
  const repayMaxWei = fusdBalanceWei < repayableDebtWei ? fusdBalanceWei : repayableDebtWei;
  const debtMaxWei = debtMode === 'borrow' ? maxBorrowWei : repayMaxWei;
  const debtMax = Number(formatUnits(debtMaxWei, 18));
  const collOver = chainState.data !== undefined && collateralWei > collMaxWei;
  const debtOver = chainState.data !== undefined && debtWei > debtMaxWei;

  // Withdrawing or borrowing must not push the position under the floor.
  const wouldBreach =
    priceReady && pending && nextDebt > 0 && preview.collateralRatio < MIN_COLLATERAL_RATIO;
  const collateralWouldBreach = collMode === 'withdraw'
    && priceReady
    && debt > 0
    && positionMetrics(Math.max(0, collateral - collAmt), debt, spyPrice).collateralRatio < MIN_COLLATERAL_RATIO;
  const debtWouldBreach = debtMode === 'borrow'
    && priceReady
    && borrowFee.data !== undefined
    && currentDebtWei + debtWei + borrowFee.data > debtCapacityWei;

  async function runTransaction(action: TxAction) {
    const account = w.address as Address | null;
    if (!account || !w.provider || pendingTx) return;

    captureEvent('position_action_requested', {
      action,
      chain_id: ROBINHOOD_TESTNET_CHAIN_ID,
      wallet_kind: w.kind,
    });
    setTxAction(action);
    setTxError(null);
    setTxHash(null);
    setTxComplete(false);
    let failureStage: TransactionFailureStage = 'switching';

    try {
      setStage('switching');
      await ensureRobinhoodTestnet(w.provider);
      const walletClient = createWalletClient({
        account,
        chain: robinhoodTestnet,
        transport: custom(w.provider),
      });
      const troveId = BigInt(position.troveId);

      async function writeAndConfirm(
        request: Parameters<typeof walletClient.writeContract>[0],
        revertedMessage: string,
      ) {
        failureStage = 'opening';
        setStage('submitting');
        let hash = await walletClient.writeContract(request);
        setTxHash(hash);
        failureStage = 'confirming';
        setStage('confirming');
        let replacementInvalid = false;
        const receipt = await robinhoodPublicClient.waitForTransactionReceipt({
          hash,
          onReplaced: (replacement) => {
            hash = replacement.transaction.hash;
            setTxHash(hash);
            if (replacement.reason !== 'repriced') {
              replacementInvalid = true;
            }
          },
        });
        if (replacementInvalid) {
          throw new Error('The transaction was cancelled or replaced by a different wallet transaction.');
        }
        if (receipt.status !== 'success') throw new Error(revertedMessage);
      }

      failureStage = 'preparing';
      if (action === 'deposit') {
        const [balance, allowance] = await Promise.all([
          robinhoodPublicClient.readContract({
            address: CONTRACTS.spyToken,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [account],
          }),
          robinhoodPublicClient.readContract({
            address: CONTRACTS.spyToken,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [account, CONTRACTS.borrowerOperations],
          }),
        ]);
        const validation = validatePositionAmount('deposit', collateralWei, balance);
        if (validation) throw new Error(validation);

        if (allowance < collateralWei) {
          failureStage = 'approving';
          setStage('approving');
          const approval = await robinhoodPublicClient.simulateContract({
            account,
            address: CONTRACTS.spyToken,
            abi: erc20Abi,
            functionName: 'approve',
            args: [CONTRACTS.borrowerOperations, collateralWei],
          });
          await writeAndConfirm(approval.request, 'The SPY approval transaction reverted.');
        }

        const adjustment = await robinhoodPublicClient.simulateContract({
          account,
          address: CONTRACTS.borrowerOperations,
          abi: borrowerOperationsAbi,
          functionName: 'addColl',
          args: [troveId, collateralWei],
        });
        await writeAndConfirm(adjustment.request, 'The collateral deposit reverted.');
        setCollStr('');
      } else if (action === 'withdraw') {
        const validation = validatePositionAmount('withdraw', collateralWei, currentCollateralWei);
        if (validation) throw new Error(validation);
        if (!priceReady || collateralWouldBreach) {
          throw new Error('This withdrawal would make the position unsafe, or the SPY oracle is unavailable.');
        }
        const adjustment = await robinhoodPublicClient.simulateContract({
          account,
          address: CONTRACTS.borrowerOperations,
          abi: borrowerOperationsAbi,
          functionName: 'withdrawColl',
          args: [troveId, collateralWei],
        });
        await writeAndConfirm(adjustment.request, 'The collateral withdrawal reverted.');
        setCollStr('');
      } else if (action === 'borrow') {
        const validation = validatePositionAmount('borrow', debtWei, 0n);
        if (validation) throw new Error(validation);
        const [predictedFee, latestPriceSimulation] = await Promise.all([
          robinhoodPublicClient.readContract({
            address: CONTRACTS.hintHelpers,
            abi: hintHelpersAbi,
            functionName: 'predictAdjustTroveUpfrontFee',
            args: [0n, troveId, debtWei],
          }),
          robinhoodPublicClient.simulateContract({
            address: CONTRACTS.spyPriceFeed,
            abi: priceFeedAbi,
            functionName: 'fetchPrice',
          }),
        ]);
        const latestPrice = validatedOraclePrice(latestPriceSimulation.result);
        const latestCapacity = (currentCollateralWei * latestPrice * 10n) / (10n ** 18n * 11n);
        if (latestPrice <= 0n || currentDebtWei + debtWei + predictedFee > latestCapacity) {
          throw new Error('This borrowing, including its upfront fee, would make the position unsafe, or the SPY oracle is unavailable.');
        }
        const adjustment = await robinhoodPublicClient.simulateContract({
          account,
          address: CONTRACTS.borrowerOperations,
          abi: borrowerOperationsAbi,
          functionName: 'withdrawBold',
          args: [troveId, debtWei, maxUpfrontFee(predictedFee)],
        });
        await writeAndConfirm(adjustment.request, 'The FUSD borrowing transaction reverted.');
        setDebtStr('');
      } else if (action === 'repay') {
        const fusdBalance = await robinhoodPublicClient.readContract({
          address: CONTRACTS.boldToken,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account],
        });
        const available = fusdBalance < maxRepayableDebt(currentDebtWei)
          ? fusdBalance
          : maxRepayableDebt(currentDebtWei);
        const validation = validatePositionAmount('repay', debtWei, available);
        if (validation) throw new Error(validation);
        const adjustment = await robinhoodPublicClient.simulateContract({
          account,
          address: CONTRACTS.borrowerOperations,
          abi: borrowerOperationsAbi,
          functionName: 'repayBold',
          args: [troveId, debtWei],
        });
        await writeAndConfirm(adjustment.request, 'The FUSD repayment reverted.');
        setDebtStr('');
      } else if (action === 'rate') {
        if (batched) throw new Error('This position is managed by an interest-rate batch.');
        if (currentRateWei !== null && rateWei === currentRateWei) {
          throw new Error('Choose a different interest rate.');
        }
        const [predictedFee, troveCount] = await Promise.all([
          robinhoodPublicClient.readContract({
            address: CONTRACTS.hintHelpers,
            abi: hintHelpersAbi,
            functionName: 'predictAdjustInterestRateUpfrontFee',
            args: [0n, troveId, rateWei],
          }),
          robinhoodPublicClient.readContract({
            address: CONTRACTS.sortedTroves,
            abi: sortedTrovesAbi,
            functionName: 'size',
          }),
        ]);
        let upperHint = 0n;
        let lowerHint = 0n;
        if (troveCount > 1n) {
          const [approxHint] = await robinhoodPublicClient.readContract({
            address: CONTRACTS.hintHelpers,
            abi: hintHelpersAbi,
            functionName: 'getApproxHint',
            args: [0n, rateWei, hintTrials(troveCount), BigInt(Date.now())],
          });
          [upperHint, lowerHint] = await robinhoodPublicClient.readContract({
            address: CONTRACTS.sortedTroves,
            abi: sortedTrovesAbi,
            functionName: 'findInsertPosition',
            args: [rateWei, approxHint, approxHint],
          });
        }
        const adjustment = await robinhoodPublicClient.simulateContract({
          account,
          address: CONTRACTS.borrowerOperations,
          abi: borrowerOperationsAbi,
          functionName: 'adjustTroveInterestRate',
          args: [troveId, rateWei, upperHint, lowerHint, maxUpfrontFee(predictedFee)],
        });
        await writeAndConfirm(adjustment.request, 'The interest-rate transaction reverted.');
      } else {
        const adjustment = await robinhoodPublicClient.simulateContract({
          account,
          address: CONTRACTS.borrowerOperations,
          abi: borrowerOperationsAbi,
          functionName: 'closeTrove',
          args: [troveId],
        });
        await writeAndConfirm(adjustment.request, 'The position-close transaction reverted.');
      }

      captureEvent('position_action_succeeded', {
        action,
        chain_id: ROBINHOOD_TESTNET_CHAIN_ID,
        wallet_kind: w.kind,
      });
      setTxComplete(true);
      window.setTimeout(onChanged, 2_000);
    } catch (cause) {
      const description = describeTransactionError(cause, failureStage);
      setTxError(description);
      captureEvent('position_action_failed', {
        action,
        failure_stage: description.stage,
        error_title: description.title,
        error_code: description.code,
        chain_id: ROBINHOOD_TESTNET_CHAIN_ID,
        wallet_kind: w.kind,
      });
    } finally {
      setStage('idle');
    }
  }


  return (
    <div className="swap">
      <h1 className="swap__title">
        <span>Your</span>
        <span className="swap__pair">
          <TokenIcon symbol="SPY" size={30} />
          <span className="swap__tok">SPY</span>
        </span>
        <span>position</span>
      </h1>

      {positions.length > 1 && (
        <div className="picker__field">
          <span className="swap__label">
            Position <em>({positions.length} open)</em>
          </span>
          <PositionPicker
            positions={positions}
            selected={position}
            spyPrice={spyPrice}
            priceReady={priceReady}
            onSelect={onSelect}
          />
        </div>
      )}

      {/* Summary, in the same card as the pool on Earn */}
      <div className="pool">
        <div className="pool__head">
          <div className="pool__ident">
            <TokenIcon symbol="SPY" size={30} />
            <span>
              <span className="pool__name">{money(collateral, 2)} SPY deposited</span>
              <span className="pool__tvl">
                worth <b>{priceReady ? `$${money(m.collateralUsd)}` : '—'}</b>
              </span>
            </span>
          </div>
          <div className="pool__aprs">
            <span>
              LTV <b>{priceReady ? pct(ltv * 100, 1) : '—'}</b>
            </span>
            <span className="pool__apr-sub">
              {priceReady ? <><i className={`swap__dot swap__dot--${m.health}`} />{m.health}</> : 'oracle unavailable'}
            </span>
          </div>
        </div>
        <div className="pool__bar">
          {priceReady && (
            <RatioBar
              ratioPct={m.collateralRatioPct}
              minPct={MIN_COLLATERAL_RATIO * 100}
              health={m.health}
            />
          )}
        </div>
        <div className="pool__foot">
          <span className="tok-row">
            Debt <b>${money(debt)}</b> <Token symbol="FUSD" size={16} />
          </span>
          <span className="tok-row">
            Free to borrow <b>{priceReady ? `$${money(freeUsd)}` : '—'}</b>
          </span>
        </div>
      </div>

      <div className="swap__meta">
        <span>
          Liquidation price <b>{priceReady ? `$${money(m.liquidationPriceUsd)}` : '—'}</b>
        </span>
        <span>
          SPY price <b>{priceReady ? `$${money(spyPrice)}` : '—'}</b>
        </span>
      </div>
      <div className="swap__meta">
        <span>
          Interest <b>${money(debt * rate / 12)}</b> / mo
        </span>
        <span>
          Market average <b>{marketAverageRate === null ? '—' : pct(marketAverageRate * 100, 2)}</b>
        </span>
      </div>

      {/* Collateral. The heading carries the mode switch, so the card below is
          only ever the amount being moved. */}
      <section className="mgmt">
        <div className="mgmt__head">
          <div className="mgmt__headline">
            <h2 className="mgmt__title">Collateral</h2>
            <Seg
              value={collMode}
              onChange={(v) => {
                captureEvent('transaction_mode_changed', { context: 'manage_collateral', mode: v });
                setCollMode(v);
                setCollStr('');
              }}
              options={[
                { id: 'deposit', label: 'Deposit' },
                { id: 'withdraw', label: 'Withdraw' },
              ]}
            />
          </div>
          <p className="mgmt__hint">
            Depositing SPY lowers your LTV and your liquidation price. Withdrawing raises both.
          </p>
        </div>
        <div className="swap__field">
          <div className="swap__row">
            <input
              className="swap__amount"
              inputMode="decimal"
              placeholder="0.00"
              value={collStr}
              onChange={(e) => setCollStr(e.target.value)}
              aria-label={`${collMode} SPY`}
            />
            <button
              type="button"
              className="swap__max"
              disabled={!chainState.data || collMaxWei <= 0n}
              onClick={() => {
                captureEvent('max_amount_selected', { context: 'manage_position', action: collMode, asset: 'SPY' });
                setCollStr(collMaxWei > 0n ? formatUnits(collMaxWei, 18) : '');
              }}
            >
              Max
            </button>
            <span className="swap__pill">
              <Token symbol="SPY" size={18} />
            </span>
          </div>
          <span className="swap__usd">
            {collMode === 'deposit'
              ? chainState.isLoading || chainState.isError
                ? 'Wallet balance unavailable'
                : `you hold ${money(spyBalance, 2)} SPY`
              : `${money(collateral, 2)} SPY in the position`}
          </span>
        </div>
        {collOver && (
          <p className="swap__over">
            {collMode === 'deposit'
              ? `You hold ${money(spyBalance, 2)} SPY.`
              : `Only ${money(collateral, 2)} SPY is in the position.`}
          </p>
        )}
        <Button
          variant={collMode === 'deposit' ? 'primary' : 'ghost'}
          disabled={
            pendingTx
            || collateralWei <= 0n
            || collOver
            || (collMode === 'deposit' && (!chainState.data || chainState.isError))
            || (collMode === 'withdraw' && (!priceReady || collateralWouldBreach))
          }
          onClick={() => void runTransaction(collMode)}
        >
          {pendingTx && txAction === collMode
            ? stage === 'approving' ? 'Approving SPY…' : 'Confirming…'
            : collMode === 'deposit' ? 'Deposit SPY' : 'Withdraw SPY'}
        </Button>
      </section>

      {/* Debt */}
      <section className="mgmt">
        <div className="mgmt__head">
          <div className="mgmt__headline">
            <h2 className="mgmt__title">Debt</h2>
            <Seg
              value={debtMode}
              onChange={(v) => {
                captureEvent('transaction_mode_changed', { context: 'manage_debt', mode: v });
                setDebtMode(v);
                setDebtStr('');
              }}
              options={[
                { id: 'borrow', label: 'Borrow' },
                { id: 'repay', label: 'Repay' },
              ]}
            />
          </div>
          <p className="mgmt__hint">
            Borrowing more FUSD raises your LTV. Repaying frees collateral to withdraw.
          </p>
        </div>
        <div className="swap__field">
          <div className="swap__row">
            <input
              className="swap__amount"
              inputMode="decimal"
              placeholder="0.00"
              value={debtStr}
              onChange={(e) => setDebtStr(e.target.value)}
              aria-label={`${debtMode} FUSD`}
            />
            <button
              type="button"
              className="swap__max"
              disabled={!chainState.data || debtMaxWei <= 0n || (debtMode === 'borrow' && maxBorrowFee.data === undefined)}
              onClick={() => {
                captureEvent('max_amount_selected', { context: 'manage_position', action: debtMode, asset: 'FUSD' });
                setDebtStr(debtMaxWei > 0n ? formatUnits(debtMaxWei, 18) : '');
              }}
            >
              Max
            </button>
            <span className="swap__pill">
              <Token symbol="FUSD" size={18} />
            </span>
          </div>
          <span className="swap__usd">
            {debtMode === 'borrow'
              ? priceReady ? `$${money(freeUsd)} free to borrow` : 'Oracle price unavailable'
              : chainState.isLoading || chainState.isError
                ? 'Wallet balance unavailable'
                : `you hold $${money(fusdBalance)} FUSD · $${money(debt)} owed`}
          </span>
        </div>
        {debtOver && (
          <p className="swap__over">
            {debtMode === 'borrow'
              ? `$${money(freeUsd)} is the most you can draw against this collateral.`
              : `You can repay at most $${money(debtMax)}.`}
          </p>
        )}
        <Button
          variant={debtMode === 'repay' ? 'primary' : 'ghost'}
          disabled={
            pendingTx
            || debtWei <= 0n
            || debtOver
            || (debtMode === 'borrow' && (!priceReady || !borrowFeeReady || borrowFee.isError || debtWouldBreach))
            || (debtMode === 'repay' && (!chainState.data || chainState.isError))
          }
          onClick={() => void runTransaction(debtMode)}
        >
          {pendingTx && txAction === debtMode
            ? 'Confirming…'
            : debtMode === 'borrow' ? 'Borrow FUSD' : 'Repay FUSD'}
        </Button>
        {debtMode === 'borrow' && borrowFee.isError && (
          <p className="swap__over">Could not quote the onchain upfront fee. Try again before submitting.</p>
        )}
      </section>

      {/* What the pending change does, before it is applied. Outside both
          sections above, because either one can be what is pending. */}
      {pending && priceReady && (
        <div className={`swap__meta${wouldBreach ? ' swap__meta--bad' : ''}`}>
          <span>
            <i className={`swap__dot swap__dot--${wouldBreach ? 'liquidation' : preview.health}`} />
            After this change
          </span>
          <span>
            LTV <b>{pct((preview.collateralUsd > 0 ? nextDebt / preview.collateralUsd : 0) * 100, 1)}</b>
            <em> ({pct(preview.collateralRatioPct, 0)} CR)</em>
          </span>
        </div>
      )}
      {wouldBreach && (
        <p className="swap__over">
          That would put the position below {pct(MIN_COLLATERAL_RATIO * 100, 0)} and make it
          liquidatable straight away.
        </p>
      )}

      {/* Rate */}
      <section className="mgmt">
        <div className="mgmt__head">
          <div className="mgmt__headline">
            <h2 className="mgmt__title">Interest rate</h2>
          </div>
          <p className="mgmt__hint">
            Lower rates cost less to hold, but are redeemed first. The market average is{' '}
            {marketAverageRate === null ? '—' : pct(marketAverageRate * 100, 2)}.
          </p>
        </div>
        <div className="swap__field swap__field--rate">
          <div className="swap__row">
            <span className="swap__amount swap__amount--rate">{pct(rate * 100, 2)}</span>
            <input
              className="slider swap__slider"
              type="range"
              min={MIN_RATE}
              max={MAX_RATE}
              step={0.0025}
              value={rate}
              disabled={batched || pendingTx}
              onChange={(e) => setRate(parseFloat(e.target.value))}
              aria-label="Interest rate"
            />
          </div>
          <span className="swap__usd">
            ${money(debt * rate)} FUSD / year on the <b>${money(debt)}</b> you owe
          </span>
        </div>
        {batched && (
          <p className="swap__over">This position’s rate is managed by an interest-rate batch.</p>
        )}
        <Button
          variant="ghost"
          disabled={pendingTx || batched || currentRateWei === null || rateWei === currentRateWei}
          onClick={() => void runTransaction('rate')}
        >
          {pendingTx && txAction === 'rate' ? 'Confirming…' : 'Update interest rate'}
        </Button>

        <details className="swap__note">
          <summary>Interest rate and redemption order</summary>
          <p>
            Redemptions are filled from the cheapest troves first. Raising your
            rate costs more but moves troves cheaper than yours in front of you.
            Exact queue depth is not available from the current market API.
          </p>
        </details>
      </section>

      {txError && (
        <div className="swap__error" role="alert">
          <p className="warn">{txError.title}</p>
          <p className="swap__error-explanation">{txError.explanation}</p>
          <details className="swap__error-details">
            <summary>Technical details</summary>
            <code>{txError.technicalDetails}</code>
          </details>
        </div>
      )}
      {txComplete && <p className="swap__usd">Transaction confirmed. Position data is refreshing…</p>}
      {txHash && (
        <p className="swap__usd">
          <a
            href={`${robinhoodTestnet.blockExplorers.default.url}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            {pendingTx ? 'View pending transaction ↗' : 'View transaction details ↗'}
          </a>
        </p>
      )}

      <Button
        variant="danger"
        disabled={pendingTx}
        onClick={() => {
          if (window.confirm(`Close this position? Your wallet must repay the full ${money(debt)} FUSD debt.`)) {
            void runTransaction('close');
          }
        }}
      >
        {pendingTx && txAction === 'close' ? 'Closing position…' : 'Close position'}
      </Button>

      <RisksDialog label="What can take this position" />
    </div>
  );
}
