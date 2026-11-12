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
import { Token, TokenIcon } from './token-icon';
import { money, pct, xnum } from '../lib/format';
import { useWallet } from './wallet/wallet';
import { useOpenPositions } from '../lib/use-open-positions';
import type { FlorinPosition } from '../lib/florin-positions';
import { positionKey, selectPosition } from '../lib/position-navigation';
import { positionMetrics } from '../lib/protocol-math';
import { MAX_RATE, MIN_COLLATERAL_RATIO, MIN_RATE } from '../lib/protocol-constants';
import { parseDisplayPercent, spyMarket, type FlorinMarkets } from '../lib/florin-markets';
import { useFlorinMarkets, useMarketAction } from '../lib/use-florin-markets';
import {
  maxWithdrawableCollateral,
  rateChangePreview,
  requireFreshRead,
  readLivePosition,
  validateTroveManager,
  borrowerOperationsAbi,
  CONTRACTS,
  erc20Abi,
  hintHelpersAbi,
  getApproxHintBatched,
  maxBorrowPrincipal,
  maxRepayableDebt,
  maxUpfrontFee,
  MIN_DEBT,
  priceFeedAbi,
  ROBINHOOD_TESTNET_CHAIN_ID,
  sortedTrovesAbi,
  validatePositionAmount,
  validatedOraclePrice,
} from '../lib/borrow-contract';
import {
  CONTRACTS as MULTIPLY_CONTRACTS,
  closeFromCollateralAmounts,
  currentMultiplierBps,
  leverPlan,
  minimumMultiplierBps,
  removeManagerAbi,
  zapperCloseAbi,
  zapperLeverAbi,
} from '../lib/multiply-contract';
import { LeverageField, MAX_LTV } from './leverage-field';
import { liquidationRisk, type RiskLevel } from '../lib/protocol-math';
import { robinhoodPublicClient } from '../lib/robinhood-client';
import { captureEvent } from '../lib/analytics';
import {
  describeTransactionError,
  type TransactionErrorDescription,
  type TransactionFailureStage,
} from '../lib/transaction-error';

type CollMode = 'deposit' | 'withdraw';
type DebtMode = 'borrow' | 'repay';
type TxAction = 'update' | 'rate' | 'close' | 'closeFromCollateral';

const RISK_LABEL: Record<RiskLevel, string> = { low: 'Low', medium: 'Medium', high: 'High' };
type CloseKind = 'close' | 'closeFromCollateral';

// Positions opened through Multiply, by trove id. The leverage zapper is set
// as their remove manager and receiver when they open, and only it can close
// them from collateral, so that is also what marks them.
function useMultiplyTroves(positions: FlorinPosition[]): Set<string> {
  const zapper = MULTIPLY_CONTRACTS.leverageZapper.toLowerCase();
  const ids = positions.map((position) => position.troveId);
  const query = useQuery({
    queryKey: ['multiply-troves', zapper, ids.join(',')],
    enabled: ids.length > 0,
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const receivers = await Promise.all(ids.map((id) => robinhoodPublicClient.readContract({
        address: CONTRACTS.borrowerOperations,
        abi: removeManagerAbi,
        functionName: 'removeManagerReceiverOf',
        args: [BigInt(id)],
      })));
      return ids.filter((_, index) => receivers[index][1].toLowerCase() === zapper);
    },
  });
  return useMemo(() => new Set(query.data ?? []), [query.data]);
}

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

// One action at a time, like Earn and like Liquity's loan screen.
type ManageTab = 'update' | 'rate' | 'close';
const TAB_LABEL: Record<ManageTab, string> = { update: 'Update', rate: 'Interest rate', close: 'Close' };

function ManageTabs({ tab, onChange }: { tab: ManageTab; onChange: (tab: ManageTab) => void }) {
  return (
    <div className="pool-tabs" role="tablist" aria-label="Position action">
      {(['update', 'rate', 'close'] as const).map((option) => (
        <button
          key={option}
          type="button"
          role="tab"
          className={tab === option ? 'pool-tabs__tab pool-tabs__tab--on' : 'pool-tabs__tab'}
          aria-selected={tab === option}
          onClick={() => onChange(option)}
        >
          {TAB_LABEL[option]}
        </button>
      ))}
    </div>
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

export function ManagePosition({ initialMarkets, requestedPosition = null }: { initialMarkets: FlorinMarkets; requestedPosition?: string | null }) {
  const w = useWallet();
  const markets = useFlorinMarkets(initialMarkets);
  const { borrow: spyMarketDetails } = spyMarket(markets);
  const marketAverageRate = parseDisplayPercent(spyMarketDetails?.avgRatePa);
  const { status, positions, error, refresh } = useOpenPositions(w.address);
  const selectionScope = `${w.address?.toLowerCase()}:${requestedPosition}`;
  const [selection, setSelection] = useState<{ scope: string; key: string } | null>(null);

  if (!w.connected || !w.address) {
    return (
      <PositionNotice title="No position found">
        Connect a wallet to view and manage its positions.
      </PositionNotice>
    );
  }
  if (positions.length === 0 && (status === 'idle' || status === 'loading')) {
    return <PositionNotice title="Loading position">Looking up this wallet’s open positions…</PositionNotice>;
  }
  if (positions.length === 0 && status === 'error') {
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

  const position = selectPosition(positions, selection?.scope === selectionScope ? selection.key : requestedPosition);
  if (!position) {
    return <PositionNotice title="Position not available" retry={refresh}>
      The requested position is not available for this wallet yet. Check the connected wallet or retry while indexing catches up.
    </PositionNotice>;
  }
  return (
    <PositionEditor
      key={`${w.address}:${positionKey(position)}`}
      position={position}
      positions={positions}
      onSelect={key => setSelection({ scope: selectionScope, key })}
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
  multiply,
}: {
  position: FlorinPosition;
  spyPrice: number;
  priceReady: boolean;
  multiply: boolean;
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
          {multiply && <span className="pos-tag">Multiply</span>}
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
  multiplyTroves,
  onSelect,
}: {
  positions: FlorinPosition[];
  selected: FlorinPosition;
  spyPrice: number;
  priceReady: boolean;
  multiplyTroves: Set<string>;
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
    const at = positions.findIndex(position => positionKey(position) === positionKey(selected));
    const next = positions[(at + delta + positions.length) % positions.length];
    if (next) onSelect(positionKey(next));
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
        <PositionLine position={selected} spyPrice={spyPrice} priceReady={priceReady} multiply={multiplyTroves.has(selected.troveId)} />
        <span className="picker__chev" aria-hidden="true" />
      </button>

      {open && (
        <ul className="picker__menu" role="listbox" aria-label="Your open positions">
          {positions.map((candidate) => {
            const current = positionKey(candidate) === positionKey(selected);
            return (
              <li key={positionKey(candidate)}>
                <button
                  type="button"
                  role="option"
                  aria-selected={current}
                  className={current ? 'picker__opt picker__opt--on' : 'picker__opt'}
                  onClick={() => {
                    onSelect(positionKey(candidate));
                    setOpen(false);
                  }}
                >
                  <PositionLine position={candidate} spyPrice={spyPrice} priceReady={priceReady} multiply={multiplyTroves.has(candidate.troveId)} />
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
  const deploymentMatches = position.troveManager.toLowerCase() === CONTRACTS.troveManager.toLowerCase();
  const prepareMarketAction = useMarketAction();
  const [rate, setRate] = useState(position.rate);
  const [rateEdited, setRateEdited] = useState(false);

  const [tab, setTab] = useState<ManageTab>('update');
  const [collMode, setCollMode] = useState<CollMode>('deposit');
  const [debtMode, setDebtMode] = useState<DebtMode>('repay');
  const [collStr, setCollStr] = useState('');
  const [debtStr, setDebtStr] = useState('');
  const [stage, setStage] = useState<TxStage>('idle');
  const [txAction, setTxAction] = useState<TxAction | null>(null);
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [txComplete, setTxComplete] = useState(false);
  const [txError, setTxError] = useState<TransactionErrorDescription | null>(null);
  const [closeChoice, setCloseChoice] = useState<CloseKind>('closeFromCollateral');
  const multiplyTroves = useMultiplyTroves(positions);
  const isMultiply = multiplyTroves.has(position.troveId);
  // Only a Multiply position can repay from its own collateral.
  const closeKind: CloseKind = isMultiply ? closeChoice : 'close';

  const collateralWei = useMemo(() => parseToken(collStr), [collStr]);
  const debtWei = useMemo(() => parseToken(debtStr), [debtStr]);
  const troveId = BigInt(position.troveId);
  const rateWei = parseUnits(rate.toString(), 18);
  const pendingTx = stage !== 'idle';
  const livePosition = useQuery({
    queryKey: ['manage-position-live', account, position.troveManager, position.troveId],
    enabled: Boolean(account) && deploymentMatches,
    refetchInterval: 15_000,
    retry: false,
    queryFn: () => readLivePosition(robinhoodPublicClient, position.troveManager, troveId),
  });
  // Keep successful values visible during background refreshes; submissions always refetch.
  const positionReady = deploymentMatches && livePosition.isSuccess;
  const currentCollateralWei = positionReady ? livePosition.data.entireColl : 0n;
  const currentDebtWei = positionReady ? livePosition.data.entireDebt : 0n;
  const collateral = Number(formatUnits(currentCollateralWei, 18));
  const debt = Number(formatUnits(currentDebtWei, 18));
  const currentRateWei = positionReady ? livePosition.data.annualInterestRate : null;
  const batched = !positionReady || livePosition.data.interestBatchManager.toLowerCase() !== zeroAddress;
  useEffect(() => {
    if (!rateEdited && livePosition.isSuccess) {
      setRate(Number(formatUnits(livePosition.data.annualInterestRate, 18)));
    }
  }, [rateEdited, livePosition.isSuccess, livePosition.data?.annualInterestRate]);

  const chainState = useQuery({
    queryKey: ['manage-position-state', account],
    enabled: Boolean(account),
    refetchInterval: 15_000,
    retry: false,
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
  const priceReady = positionReady && chainState.isSuccess && chainState.data.price > 0n;
  const spyPrice = chainState.data ? Number(formatUnits(chainState.data.price, 18)) : 0;
  const spyBalanceWei = chainState.data?.spyBalance ?? 0n;
  const fusdBalanceWei = chainState.data?.fusdBalance ?? 0n;
  const spyBalance = Number(formatUnits(spyBalanceWei, 18));
  const fusdBalance = Number(formatUnits(fusdBalanceWei, 18));
  const debtCapacityWei = priceReady && chainState.data
    ? (currentCollateralWei * chainState.data.price * 10n) / (10n ** 18n * 11n)
    : 0n;
  const debtRoomWei = debtCapacityWei > currentDebtWei ? debtCapacityWei - currentDebtWei : 0n;

  const borrowFee = useQuery({
    queryKey: ['adjust-trove-fee', position.troveId, debtWei.toString()],
    enabled: positionReady && debtMode === 'borrow' && debtWei > 0n,
    retry: false,
    refetchInterval: 15_000,
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
    retry: false,
    refetchInterval: 15_000,
    queryFn: () => robinhoodPublicClient.readContract({
      address: CONTRACTS.hintHelpers,
      abi: hintHelpersAbi,
      functionName: 'predictAdjustTroveUpfrontFee',
      args: [0n, troveId, debtRoomWei],
    }),
  });
  const borrowFeeReady = debtMode !== 'borrow' || debtWei <= 0n || borrowFee.isSuccess;
  const maxBorrowWei = !priceReady || !maxBorrowFee.isSuccess
    ? 0n
    : maxBorrowPrincipal(debtCapacityWei, currentDebtWei, maxBorrowFee.data);

  const closeSizing = priceReady && chainState.data
    ? closeFromCollateralAmounts(currentCollateralWei, currentDebtWei, chainState.data.price)
    : null;

  // Leverage, for Multiply positions. The slider starts where the position
  // stands and only moves when the holder moves it.
  const livePrice = priceReady && chainState.data ? chainState.data.price : 0n;
  const currentLeverBps = livePrice > 0n ? currentMultiplierBps(currentCollateralWei, currentDebtWei, livePrice) : null;
  // An update sends the SPY change first, so leverage is planned from the
  // collateral after it.
  const baseCollateralWei = !isMultiply || collateralWei <= 0n
    ? currentCollateralWei
    : collMode === 'deposit'
      ? currentCollateralWei + collateralWei
      : collateralWei < currentCollateralWei ? currentCollateralWei - collateralWei : currentCollateralWei;
  const lowestLeverBps = livePrice > 0n ? minimumMultiplierBps(baseCollateralWei, currentDebtWei, livePrice, MIN_DEBT) : null;
  const [leverBps, setLeverBps] = useState<number | null>(null);
  const targetLeverBps = leverBps ?? (currentLeverBps === null ? null : Math.round(currentLeverBps / 1_000) * 1_000);
  const lever = isMultiply && targetLeverBps !== null && leverBps !== null && livePrice > 0n
    ? leverPlan(baseCollateralWei, currentDebtWei, livePrice, targetLeverBps)
    : null;
  const leverFee = useQuery({
    queryKey: ['lever-up-fee', position.troveId, lever?.kind === 'up' ? lever.boldAmount.toString() : '0'],
    enabled: lever?.kind === 'up',
    retry: false,
    refetchInterval: 15_000,
    queryFn: () => robinhoodPublicClient.readContract({
      address: CONTRACTS.hintHelpers,
      abi: hintHelpersAbi,
      functionName: 'predictAdjustTroveUpfrontFee',
      args: [0n, troveId, lever?.kind === 'up' ? lever.boldAmount : 0n],
    }),
  });
  const leverCollateralAfter = lever ? Number(formatUnits(lever.collateralAfter, 18)) : collateral;
  const leverDebtAfter = !lever
    ? debt
    : lever.kind === 'up'
      ? debt + Number(formatUnits(lever.boldAmount + (leverFee.data ?? 0n), 18))
      : Number(formatUnits(lever.debtAfter, 18));
  const leverValueAfter = leverCollateralAfter * spyPrice;
  const leverLtvAfter = leverValueAfter > 0 ? leverDebtAfter / leverValueAfter : 0;
  const leverLiquidationAfter = leverCollateralAfter > 0 ? MIN_COLLATERAL_RATIO * leverDebtAfter / leverCollateralAfter : 0;
  const leverRisk = liquidationRisk(leverLtvAfter, MAX_LTV);
  const leverTooLow = lever?.kind === 'down' && lever.debtAfter < MIN_DEBT;
  const leverUnsafe = leverLtvAfter >= MAX_LTV;
  const leverReady = Boolean(lever) && (lever?.kind !== 'up' || leverFee.isSuccess) && !leverTooLow && !leverUnsafe;

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

  const withdrawalMaxWei = priceReady && chainState.data
    ? maxWithdrawableCollateral(currentCollateralWei, currentDebtWei, chainState.data.price) : 0n;
  const collMaxWei = collMode === 'deposit' ? spyBalanceWei : withdrawalMaxWei;
  const repayableDebtWei = maxRepayableDebt(currentDebtWei);
  const repayMaxWei = fusdBalanceWei < repayableDebtWei ? fusdBalanceWei : repayableDebtWei;
  const debtMaxWei = debtMode === 'borrow' ? maxBorrowWei : repayMaxWei;
  const debtMax = Number(formatUnits(debtMaxWei, 18));
  // Collateral and debt move together, so a withdrawal is only capped by what
  // the position holds; the combined check below decides whether it is safe.
  // A Multiply update sends its SPY change on its own, so that one has to be
  // safe by itself.
  const collLimitWei = collMode === 'deposit'
    ? spyBalanceWei
    : isMultiply ? withdrawalMaxWei : currentCollateralWei;
  const collOver = positionReady && chainState.isSuccess
    && (collMode === 'deposit' || priceReady) && collateralWei > collLimitWei;
  const debtOver = positionReady && chainState.isSuccess
    && debtMode === 'repay' && debtWei > repayMaxWei;

  // The combined change must not push the position under the floor.
  const previewCollateralWei = collMode === 'deposit'
    ? currentCollateralWei + collateralWei : currentCollateralWei - collateralWei;
  const previewDebtWei = debtMode === 'borrow'
    ? currentDebtWei + debtWei + (borrowFee.data ?? 0n) : currentDebtWei - debtWei;
  const wouldBreach = priceReady && pending && chainState.data && borrowFeeReady
    && previewCollateralWei * chainState.data.price * 10n < previewDebtWei * 11n * 10n ** 18n;
  const updateReady = !pendingTx
    && positionReady
    && priceReady
    && (collateralWei > 0n || debtWei > 0n || lever !== null)
    && !collOver
    && !debtOver
    && !wouldBreach
    && borrowFeeReady
    && !(debtMode === 'borrow' && debtWei > 0n && borrowFee.isError)
    && (lever === null || leverReady);

  const fusdShort = Boolean(chainState.data) && positionReady && fusdBalanceWei < currentDebtWei;
  const closeSold = closeSizing ? Number(formatUnits(closeSizing.flashLoanAmount, 18)) : 0;

  const rateFee = useQuery({
    queryKey: ['rate-change-fee', position.troveManager, position.troveId, rateWei.toString()],
    enabled: positionReady && !batched && rateWei !== currentRateWei,
    retry: false,
    refetchInterval: 15_000,
    queryFn: () => {
      validateTroveManager(position.troveManager);
      return robinhoodPublicClient.readContract({
        address: CONTRACTS.hintHelpers, abi: hintHelpersAbi,
        functionName: 'predictAdjustInterestRateUpfrontFee', args: [0n, troveId, rateWei],
      });
    },
  });
  const ratePreview = priceReady && chainState.data && rateFee.isSuccess
    ? rateChangePreview(currentCollateralWei, currentDebtWei, chainState.data.price, rateWei, rateFee.data)
    : null;
  const rateMetrics = ratePreview
    ? positionMetrics(collateral, Number(formatUnits(ratePreview.resultingDebt, 18)), spyPrice) : null;

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
      validateTroveManager(position.troveManager);
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
        delta?: { deposited?: number; debtIssued?: number },
      ) {
        const updateMarkets = prepareMarketAction();
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
        if (delta) updateMarkets(receipt, delta);
      }

      failureStage = 'preparing';
      const latest = requireFreshRead(await livePosition.refetch());
      const currentCollateralWei = latest.entireColl;
      const currentDebtWei = latest.entireDebt;
      if (action === 'update') {
        // Checked again from fresh reads, never from what the preview showed.
        const state = requireFreshRead(await chainState.refetch());
        const isCollIncrease = collMode === 'deposit';
        const isDebtIncrease = debtMode === 'borrow';
        // A Multiply position has no debt field. Its debt moves with leverage.
        const boldChange = isMultiply ? 0n : debtWei;

        if (collateralWei > 0n || boldChange > 0n) {
          if (isCollIncrease && collateralWei > 0n) {
            const validation = validatePositionAmount('deposit', collateralWei, state.spyBalance);
            if (validation) throw new Error(validation);
          }
          if (!isCollIncrease && collateralWei >= currentCollateralWei) {
            throw new Error('The position does not have that much SPY.');
          }
          if (!isDebtIncrease && boldChange > 0n) {
            const repayable = maxRepayableDebt(currentDebtWei);
            const validation = validatePositionAmount('repay', boldChange,
              state.fusdBalance < repayable ? state.fusdBalance : repayable);
            if (validation) throw new Error(validation);
          }
          const fee = isDebtIncrease && boldChange > 0n
            ? await robinhoodPublicClient.readContract({
              address: CONTRACTS.hintHelpers,
              abi: hintHelpersAbi,
              functionName: 'predictAdjustTroveUpfrontFee',
              args: [0n, troveId, boldChange],
            })
            : 0n;
          const collAfter = isCollIncrease ? currentCollateralWei + collateralWei : currentCollateralWei - collateralWei;
          const debtAfter = isDebtIncrease ? currentDebtWei + boldChange + fee : currentDebtWei - boldChange;
          if (state.price <= 0n || collAfter * state.price * 10n < debtAfter * 11n * 10n ** 18n) {
            throw new Error('This change, including any upfront fee, would put the position below 110% collateralization, or the SPY oracle is unavailable.');
          }

          if (isCollIncrease && collateralWei > 0n) {
            const allowance = await robinhoodPublicClient.readContract({
              address: CONTRACTS.spyToken,
              abi: erc20Abi,
              functionName: 'allowance',
              args: [account, CONTRACTS.borrowerOperations],
            });
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
          }

          const adjustment = await robinhoodPublicClient.simulateContract({
            account,
            address: CONTRACTS.borrowerOperations,
            abi: borrowerOperationsAbi,
            functionName: 'adjustTrove',
            args: [
              troveId,
              collateralWei,
              isCollIncrease,
              boldChange,
              isDebtIncrease,
              isDebtIncrease && boldChange > 0n ? maxUpfrontFee(fee) : 0n,
            ],
          });
          await writeAndConfirm(adjustment.request, 'The position update reverted.', {
            deposited: (isCollIncrease ? 1 : -1) * Number(formatUnits(collateralWei, 18)),
            debtIssued: (isDebtIncrease ? 1 : -1) * Number(formatUnits(boldChange, 18)),
          });
          setCollStr('');
          setDebtStr('');
        }

        // Leverage last, planned from the position as it stands after any
        // SPY change above.
        if (isMultiply && leverBps !== null) {
          failureStage = 'preparing';
          const [freshResult, leverStateResult] = await Promise.all([livePosition.refetch(), chainState.refetch()]);
          const fresh = requireFreshRead(freshResult);
          const leverState = requireFreshRead(leverStateResult);
          const plan = leverPlan(fresh.entireColl, fresh.entireDebt, leverState.price, leverBps);
          if (!plan) throw new Error('The position is already at that multiplier.');
          if (plan.kind === 'up') {
            const fee = await robinhoodPublicClient.readContract({
              address: CONTRACTS.hintHelpers,
              abi: hintHelpersAbi,
              functionName: 'predictAdjustTroveUpfrontFee',
              args: [0n, troveId, plan.boldAmount],
            });
            const adjustment = await robinhoodPublicClient.simulateContract({
              account,
              address: MULTIPLY_CONTRACTS.leverageZapper,
              abi: zapperLeverAbi,
              functionName: 'leverUpTrove',
              args: [{ troveId, flashLoanAmount: plan.flashLoanAmount, boldAmount: plan.boldAmount, maxUpfrontFee: maxUpfrontFee(fee) }],
            });
            await writeAndConfirm(adjustment.request, 'The leverage transaction reverted.', {
              deposited: Number(formatUnits(plan.flashLoanAmount, 18)),
              debtIssued: Number(formatUnits(plan.boldAmount + fee, 18)),
            });
          } else {
            if (plan.debtAfter < MIN_DEBT) {
              throw new Error(`That would leave less than ${formatUnits(MIN_DEBT, 18)} FUSD of debt. Choose a higher multiplier, or close the position.`);
            }
            const adjustment = await robinhoodPublicClient.simulateContract({
              account,
              address: MULTIPLY_CONTRACTS.leverageZapper,
              abi: zapperLeverAbi,
              functionName: 'leverDownTrove',
              args: [{ troveId, flashLoanAmount: plan.flashLoanAmount, minBoldAmount: plan.minBoldAmount }],
            });
            await writeAndConfirm(adjustment.request, 'The leverage transaction reverted.', {
              deposited: -Number(formatUnits(plan.flashLoanAmount, 18)),
              debtIssued: -Number(formatUnits(fresh.entireDebt - plan.debtAfter, 18)),
            });
          }
          setLeverBps(null);
        }
      } else if (action === 'rate') {
        if (latest.interestBatchManager.toLowerCase() !== zeroAddress) throw new Error('This position is managed by an interest-rate batch.');
        if (rateWei === latest.annualInterestRate) {
          throw new Error('Choose a different interest rate.');
        }
        const troveCount = await robinhoodPublicClient.readContract({
          address: CONTRACTS.sortedTroves,
          abi: sortedTrovesAbi,
          functionName: 'size',
        });
        let upperHint = 0n;
        let lowerHint = 0n;
        if (troveCount > 1n) {
          const approxHint = await getApproxHintBatched(robinhoodPublicClient, rateWei, troveCount);
          [upperHint, lowerHint] = await robinhoodPublicClient.readContract({
            address: CONTRACTS.sortedTroves,
            abi: sortedTrovesAbi,
            functionName: 'findInsertPosition',
            args: [rateWei, approxHint, approxHint],
          });
        }
        // Hint search can take time; refresh the fee and safety inputs afterwards.
        const [freshResult, feeResult, stateResult] = await Promise.all([
          livePosition.refetch(), rateFee.refetch(), chainState.refetch(),
        ]);
        const fresh = requireFreshRead(freshResult);
        const freshFee = requireFreshRead(feeResult);
        const state = requireFreshRead(stateResult);
        const feeLimit = maxUpfrontFee(freshFee);
        if (fresh.interestBatchManager.toLowerCase() !== zeroAddress || rateWei === fresh.annualInterestRate) {
          throw new Error('The position’s live interest-rate settings changed. Review and try again.');
        }
        if (!rateChangePreview(fresh.entireColl, fresh.entireDebt, state.price, rateWei, feeLimit).safe) {
          throw new Error('The rate-change fee would make this position unsafe.');
        }
        const adjustment = await robinhoodPublicClient.simulateContract({
          account,
          address: CONTRACTS.borrowerOperations,
          abi: borrowerOperationsAbi,
          functionName: 'adjustTroveInterestRate',
          args: [troveId, rateWei, upperHint, lowerHint, feeLimit],
        });
        await writeAndConfirm(adjustment.request, 'The interest-rate transaction reverted.');
      } else if (action === 'closeFromCollateral') {
        // Sized from fresh position and oracle reads, never from what the
        // dialog showed, since debt accrues and the price moves.
        const state = requireFreshRead(await chainState.refetch());
        const sizing = closeFromCollateralAmounts(currentCollateralWei, currentDebtWei, state.price);
        if (!sizing) throw new Error('The position’s debt is worth too much of its collateral to close from collateral.');
        const adjustment = await robinhoodPublicClient.simulateContract({
          account,
          address: MULTIPLY_CONTRACTS.leverageZapper,
          abi: zapperCloseAbi,
          functionName: 'closeTroveFromCollateral',
          args: [troveId, sizing.flashLoanAmount, sizing.minExpectedCollateral],
        });
        await writeAndConfirm(adjustment.request, 'The position-close transaction reverted.', {
          deposited: -Number(formatUnits(currentCollateralWei, 18)),
          debtIssued: -Number(formatUnits(currentDebtWei, 18)),
        });
      } else {
        const adjustment = await robinhoodPublicClient.simulateContract({
          account,
          address: CONTRACTS.borrowerOperations,
          abi: borrowerOperationsAbi,
          functionName: 'closeTrove',
          args: [troveId],
        });
        await writeAndConfirm(adjustment.request, 'The position-close transaction reverted.', {
          deposited: -Number(formatUnits(currentCollateralWei, 18)),
          debtIssued: -Number(formatUnits(currentDebtWei, 18)),
        });
      }

      captureEvent('position_action_succeeded', {
        action,
        chain_id: ROBINHOOD_TESTNET_CHAIN_ID,
        wallet_kind: w.kind,
      });
      setTxComplete(true);
      await Promise.all([livePosition.refetch(), chainState.refetch(), rateFee.refetch(), borrowFee.refetch(), maxBorrowFee.refetch()]);
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
      {/* With one position there is no picker to carry the flag. */}
      {isMultiply && positions.length <= 1 && (
        <p className="pos-tag-line"><span className="pos-tag">Multiply</span></p>
      )}

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
            multiplyTroves={multiplyTroves}
            onSelect={onSelect}
          />
        </div>
      )}

      {!positionReady && (
        <p className="swap__over" role="status">
          {!deploymentMatches ? 'Unsupported position deployment. Actions are disabled.'
            : livePosition.isError ? 'Live position data unavailable. Actions are disabled until a successful refresh.'
              : 'Refreshing live position data…'}
        </p>
      )}
      {/* Summary, in the same card as the pool on Earn */}
      <div className="pool">
        <div className="pool__head">
          <div className="pool__ident">
            <TokenIcon symbol="SPY" size={30} />
            <span>
              <span className="pool__name">{positionReady ? money(collateral, 2) : '—'} SPY deposited</span>
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
            Debt <b>{positionReady ? `$${money(debt)}` : '—'}</b> <Token symbol="FUSD" size={16} />
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
          Interest <b>{currentRateWei === null ? '—' : `$${money(debt * Number(formatUnits(currentRateWei, 18)) / 12)}`}</b> / mo
        </span>
        <span>
          Market average <b>{marketAverageRate === null ? '—' : pct(marketAverageRate * 100, 2)}</b>
        </span>
      </div>

      <ManageTabs
        tab={tab}
        onChange={(next) => {
          if (next === tab) return;
          captureEvent('transaction_mode_changed', { context: 'manage_tab', mode: next });
          setTab(next);
          // Drafts from another tab would otherwise linger in the preview.
          setCollStr('');
          setDebtStr('');
          setLeverBps(null);
          setRateEdited(false);
        }}
      />

      {/* Update: collateral and debt together, sent as one adjustTrove like
          Liquity. A Multiply position moves its debt with the leverage slider
          instead, through the zapper. */}
      {tab === 'update' && (
        <>
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
                  disabled={!positionReady || !chainState.isSuccess || chainState.isFetching || collMaxWei <= 0n}
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
                  : isMultiply
                    ? `The current 110% collateralization limit allows up to ${formatUnits(withdrawalMaxWei, 18)} SPY.`
                    : `The position holds ${money(collateral, 4)} SPY.`}
              </p>
            )}
          </section>

          {isMultiply ? (
            <section className="mgmt">
              <div className="mgmt__head">
                <div className="mgmt__headline">
                  <h2 className="mgmt__title">Leverage</h2>
                  <span className="mgmt__now">
                    Now <b>{currentLeverBps === null ? '—' : `${(Math.round(currentLeverBps / 1_000) / 10).toFixed(1)}x`}</b>
                  </span>
                </div>
              </div>
              <LeverageField
                multiplierBps={targetLeverBps ?? 20_000}
                onChange={setLeverBps}
                spyPrice={spyPrice}
                liquidationPrice={lever ? leverLiquidationAfter : m.liquidationPriceUsd}
                disabled={pendingTx || !priceReady || currentLeverBps === null}
                minBps={lowestLeverBps ?? undefined}
                currentBps={currentLeverBps}
              />
              {lowestLeverBps !== null && currentLeverBps !== null && lowestLeverBps > currentLeverBps && (
                <p className="mgmt__hint">
                  This position is at the 1,000 FUSD minimum debt, so it can only be levered up. To exit,
                  close it.
                </p>
              )}
              {leverTooLow && (
                <p className="swap__over">That would leave less than 1,000 FUSD of debt. Choose a higher multiplier, or close the position.</p>
              )}
              {lever?.kind === 'up' && leverFee.isError && (
                <p className="swap__over">Could not quote the onchain upfront fee. Try again before submitting.</p>
              )}
            </section>
          ) : (
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
                    disabled={!positionReady || !chainState.isSuccess || chainState.isFetching || debtMaxWei <= 0n || (debtMode === 'borrow' && !maxBorrowFee.isSuccess)}
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
              {debtOver && <p className="swap__over">You can repay at most ${money(debtMax)}.</p>}
              {debtMode === 'borrow' && borrowFee.isError && (
                <p className="swap__over">Could not quote the onchain upfront fee. Try again before submitting.</p>
              )}
            </section>
          )}

          {/* What the position becomes, before it is applied. */}
          {lever ? (
            <>
              <div className="swap__meta">
                <span className={`risk-tag risk-tag--${leverRisk}`}>
                  <i className={`swap__dot swap__dot--${leverRisk}`} />
                  {RISK_LABEL[leverRisk]} liquidation risk
                </span>
                <span>LTV <b>{pct(ltv * 100, 1)}</b> → <b>{pct(leverLtvAfter * 100, 1)}</b></span>
              </div>
              <div className="swap__meta swap__meta--right">
                <span>Exposure <b>{money(collateral, 4)}</b> → <b>{money(leverCollateralAfter, 4)} SPY</b></span>
              </div>
            </>
          ) : pending && priceReady && borrowFeeReady && (
            <div className={`swap__meta${wouldBreach ? ' swap__meta--bad' : ''}`}>
              <span>
                <i className={`swap__dot swap__dot--${wouldBreach ? 'liquidation' : preview.health}`} />
                LTV <b>{pct(ltv * 100, 1)}</b> → <b>{pct((preview.collateralUsd > 0 ? nextDebt / preview.collateralUsd : 0) * 100, 1)}</b>
              </span>
              <span>
                Liquidation price <b>${money(preview.liquidationPriceUsd)}</b>
              </span>
            </div>
          )}
          {wouldBreach && (
            <p className="swap__over">
              That would put the position below {pct(MIN_COLLATERAL_RATIO * 100, 0)} and make it
              liquidatable straight away.
            </p>
          )}
          {lever && collateralWei > 0n && (
            <p className="mgmt__hint">This takes two transactions, the SPY change and then the leverage change.</p>
          )}
          <Button variant="primary" disabled={!updateReady} onClick={() => void runTransaction('update')}>
            {pendingTx && txAction === 'update'
              ? stage === 'approving' ? 'Approving SPY…' : 'Confirming…'
              : lever && collateralWei <= 0n
                ? lever.kind === 'down' ? 'Lower leverage' : 'Raise leverage'
                : 'Update position'}
          </Button>
        </>
      )}
      {/* Rate */}
      {tab === 'rate' && (
      <section className="mgmt">
        <div className="mgmt__head">
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
              onChange={(e) => {
                setRateEdited(true);
                setRate(parseFloat(e.target.value));
              }}
              aria-label="Interest rate"
            />
          </div>
          <span className="swap__usd">
            {rateWei === currentRateWei ? 'Choose a different rate to preview its upfront fee.'
              : !deploymentMatches || livePosition.isError || chainState.isError ? 'Live position or price unavailable. Rate changes are disabled.'
              : rateFee.isError ? 'Rate-change fee unavailable. Try again before submitting.'
                : !ratePreview ? 'Loading live position, price and rate-change fee…'
                  : `Upfront fee: $${money(Number(formatUnits(ratePreview.fee, 18)), 4)} FUSD`}
          </span>
        </div>
        {rateWei !== currentRateWei && ratePreview && rateMetrics && (
          <>
            <div className="swap__meta">
              <span>Resulting debt <b>${money(Number(formatUnits(ratePreview.resultingDebt, 18)), 4)}</b></span>
              <span>Collateral ratio <b>{pct(rateMetrics.collateralRatioPct, 2)}</b></span>
            </div>
            <div className="swap__meta">
              <span>Liquidation price <b>${money(rateMetrics.liquidationPriceUsd)}</b></span>
              <span>Interest <b>${money(Number(formatUnits(ratePreview.annualInterest, 18)), 4)}</b> / year · <b>${money(Number(formatUnits(ratePreview.monthlyInterest, 18)), 4)}</b> / mo</span>
            </div>
            {!ratePreview.safe && <p className="swap__over">The rate-change fee would make this position unsafe.</p>}
          </>
        )}
        {positionReady && batched && (
          <p className="swap__over">This position’s rate is managed by an interest-rate batch.</p>
        )}
        <Button
          variant="ghost"
          disabled={pendingTx || !positionReady || batched || currentRateWei === null || rateWei === currentRateWei || !ratePreview?.safe}
          onClick={() => void runTransaction('rate')}
        >
          {pendingTx && txAction === 'rate' ? 'Confirming…' : 'Update interest rate'}
        </Button>

        <details className="swap__note">
          <summary>Redemptions in a nutshell</summary>
          <p>
            Redemptions keep FUSD worth a dollar. If your position is redeemed, your collateral and
            your debt fall by the same value, so you lose some exposure to SPY but no money.
          </p>
          <ul>
            <li>Redemptions happen when FUSD trades below $1.</li>
            <li>Positions paying the lowest interest rate are redeemed first.</li>
            <li>Raising your interest rate lowers your redemption risk.</li>
          </ul>
        </details>
      </section>
      )}

      {/* Close. The tab is the confirmation: it says what is repaid and what
          comes back before the wallet asks. A Multiply position can also repay
          from its own SPY, so a holder who spent the FUSD can still unwind. */}
      {tab === 'close' && (
        <section className="mgmt">
          {isMultiply && (
            <div className="mgmt__head">
              <div className="mgmt__headline">
                <h2 className="mgmt__title">Repay with</h2>
                <Seg
                  value={closeKind}
                  onChange={(v) => {
                    captureEvent('transaction_mode_changed', { context: 'manage_close', mode: v });
                    setCloseChoice(v);
                  }}
                  options={[
                    { id: 'closeFromCollateral', label: 'SPY' },
                    { id: 'close', label: 'FUSD' },
                  ]}
                />
              </div>
            </div>
          )}
          <p className="mgmt__hint">
            {closeKind === 'closeFromCollateral'
              ? `About ${money(closeSold, 4)} SPY from the position is sold to repay its debt. You do not need any FUSD in your wallet.`
              : 'Your wallet repays the full debt and the position is closed.'}
          </p>
          <dl className="close-facts">
            <div>
              <dt>You repay</dt>
              <dd>
                {positionReady ? money(debt) : '—'} FUSD
                <em>{closeKind === 'closeFromCollateral' ? 'from the position' : 'from your wallet'}</em>
              </dd>
            </div>
            <div>
              <dt>You get back</dt>
              <dd>
                {closeKind === 'closeFromCollateral'
                  ? closeSizing ? `About ${money(Number(formatUnits(closeSizing.expectedReturn, 18)), 4)}` : '—'
                  : positionReady ? money(collateral, 4) : '—'} SPY
                <em>plus the 0.001 ETH gas deposit</em>
              </dd>
            </div>
          </dl>
          {closeKind === 'close' && fusdShort && (
            <p className="swap__over">
              You hold ${money(fusdBalance)} FUSD. Closing needs ${money(debt)}.
            </p>
          )}
          {closeKind === 'closeFromCollateral' && priceReady && !closeSizing && (
            <p className="swap__over">This position’s debt is too large to close from its collateral.</p>
          )}
          <Button
            variant="danger"
            disabled={
              pendingTx
              || !positionReady
              || (closeKind === 'close' && (!chainState.data || fusdShort))
              || (closeKind === 'closeFromCollateral' && (!priceReady || !closeSizing))
            }
            onClick={() => void runTransaction(closeKind)}
          >
            {pendingTx && txAction === closeKind ? 'Closing position…' : 'Close position'}
          </Button>
        </section>
      )}

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
    </div>
  );
}
