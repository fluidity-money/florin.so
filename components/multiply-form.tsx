'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  http,
  isAddress,
  parseUnits,
  zeroAddress,
  type Address,
  type Hash,
} from 'viem';
import { robinhoodTestnet } from '@reown/appkit/networks';
import { Button } from './ui';
import { Token, TokenIcon } from './token-icon';
import { useWallet } from './wallet/wallet';
import Link from 'next/link';
import { pendingPositions, positionsFromReceipt } from '../lib/pending-positions';
import { managePositionHref } from '../lib/position-navigation';
import type { FlorinPosition } from '../lib/florin-positions';
import { money, pct, xnum } from '../lib/format';
import { DEFAULT_RATE, MAX_RATE, MIN_COLLATERAL_RATIO, MIN_RATE } from '../lib/protocol-constants';
import {
  CONTRACTS as BORROW_CONTRACTS,
  erc20Abi,
  hintHelpersAbi,
  getApproxHintBatched,
  LIQUIDATOR_COMPENSATION_WETH,
  maxUpfrontFee,
  MIN_DEBT,
  priceFeedAbi,
  randomOwnerIndex,
  ROBINHOOD_TESTNET_CHAIN_ID,
  sortedTrovesAbi,
  validatedOraclePrice,
} from '../lib/borrow-contract';
import {
  quoteMultiply,
  verifyMultiplyDeployment,
  isMultiplyCollateralSafe,
  CONTRACTS,
  leverageZapperAbi,
  multiplierForLiquidationPrice,
  multiplyAmountsBps,
} from '../lib/multiply-contract';
import { LTV_RISK, liquidationRisk, type RiskLevel } from '../lib/protocol-math';

const publicClient = createPublicClient({ chain: robinhoodTestnet, transport: http() });
// Multiples in basis points: 10,000 is 1x. The slider moves in 0.1x steps.
const MIN_MULTIPLIER_BPS = 11_000;
const MAX_MULTIPLIER_BPS = 50_000;
const MULTIPLIER_STEP_BPS = 1_000;
const MULTIPLIER_TICKS = [11_000, 20_000, 30_000, 40_000, 50_000];
const MAX_LTV = 1 / MIN_COLLATERAL_RATIO;

const RISK_LABEL: Record<RiskLevel, string> = { low: 'Low', medium: 'Medium', high: 'High' };

// Where a multiple sits along the slider, as a percentage of its width.
function sliderPosition(bps: number): number {
  return ((bps - MIN_MULTIPLIER_BPS) / (MAX_MULTIPLIER_BPS - MIN_MULTIPLIER_BPS)) * 100;
}

// The multiple at which a given LTV is reached: LTV = (m - 1) / m.
function multipleAtLtv(ltv: number): number {
  return Math.round(10_000 / (1 - ltv));
}

// Green, then amber, then red along the track, changing colour where the
// liquidation risk bands change, so the slider says what the tag will say.
const TRACK_STOPS = (() => {
  const medium = Math.min(100, Math.max(0, sliderPosition(multipleAtLtv(LTV_RISK.medium * MAX_LTV))));
  const high = Math.min(100, Math.max(0, sliderPosition(multipleAtLtv(LTV_RISK.high * MAX_LTV))));
  return `linear-gradient(90deg, var(--risk-ok) 0%, var(--risk-ok) ${medium}%, var(--risk-warn) ${medium}%, var(--risk-warn) ${high}%, var(--risk-bad) ${high}%, var(--risk-bad) 100%)`;
})();

type SizeBy = 'multiplier' | 'liquidation';

type Stage = 'idle' | 'switching' | 'approving' | 'opening' | 'confirming';

function parseToken(value: string): bigint {
  try {
    return value.trim() ? parseUnits(value, 18) : 0n;
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

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return (error as Error & { shortMessage?: string }).shortMessage ?? error.message;
  }
  return String(error);
}

export function MultiplyForm() {
  const wallet = useWallet();
  const account = wallet.address as Address | null;
  const zapperAddress = CONTRACTS.leverageZapper;
  const exchangeAddress = CONTRACTS.exchange;
  const zapperConfigured = Boolean(
    zapperAddress
    && exchangeAddress
    && isAddress(zapperAddress)
    && isAddress(exchangeAddress)
    && zapperAddress !== zeroAddress
    && exchangeAddress !== zeroAddress,
  );
  const [depositStr, setDepositStr] = useState('');
  const [multiplierBps, setMultiplierBps] = useState(20_000);
  // Size the position by its multiple or by where it liquidates. Both drive
  // the same slider; only the number you type into changes.
  const [sizeBy, setSizeBy] = useState<SizeBy>('liquidation');
  // What the holder is typing into the liquidation price box. Null shows the
  // price that the current multiple actually produces.
  const [liquidationDraft, setLiquidationDraft] = useState<string | null>(null);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [complete, setComplete] = useState(false);
  const [openedPosition, setOpenedPosition] = useState<FlorinPosition | null>(null);

  const depositWei = useMemo(() => parseToken(depositStr), [depositStr]);
  const rateWei = BigInt(Math.round(rate * 1e18));

  const oraclePrice = useQuery({
    queryKey: ['spy-oracle-price'],
    refetchInterval: 15_000,
    retry: false,
    queryFn: async () => {
      const simulation = await publicClient.simulateContract({
        address: BORROW_CONTRACTS.spyPriceFeed,
        abi: priceFeedAbi,
        functionName: 'fetchPrice',
      });
      return validatedOraclePrice(simulation.result);
    },
  });

  const amounts = multiplyAmountsBps(depositWei, multiplierBps);

  const swapQuote = useQuery({
    queryKey: ['multiply-swap-quote', exchangeAddress, amounts.flashLoanAmount.toString()],
    enabled: Boolean(zapperConfigured && exchangeAddress && amounts.flashLoanAmount > 0n),
    retry: false,
    refetchInterval: 15_000,
    queryFn: async () => (await quoteMultiply(publicClient, exchangeAddress, BORROW_CONTRACTS, amounts.flashLoanAmount)).boldAmount,
  });
  const boldAmount = swapQuote.isError ? 0n : swapQuote.data ?? 0n;

  async function readWalletState() {
    if (!account) throw new Error('Connect a wallet first.');
    const [balance, allowance, nativeBalance] = await Promise.all([
      publicClient.readContract({ address: BORROW_CONTRACTS.spyToken, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
      publicClient.readContract({ address: BORROW_CONTRACTS.spyToken, abi: erc20Abi, functionName: 'allowance', args: [account, zapperAddress] }),
      publicClient.getBalance({ address: account }),
      verifyMultiplyDeployment(publicClient, zapperAddress, exchangeAddress, BORROW_CONTRACTS),
    ]);
    return { balance, allowance, nativeBalance };
  }
  const chainState = useQuery({
    queryKey: ['multiply-state', account, zapperAddress, exchangeAddress],
    enabled: Boolean(account && zapperConfigured),
    refetchInterval: 15_000,
    queryFn: readWalletState,
  });

  const upfrontFee = useQuery({
    queryKey: ['multiply-upfront-fee', boldAmount.toString(), rateWei.toString()],
    enabled: boldAmount > 0n,
    queryFn: () => publicClient.readContract({
      address: BORROW_CONTRACTS.hintHelpers,
      abi: hintHelpersAbi,
      functionName: 'predictOpenTroveUpfrontFee',
      args: [0n, boldAmount, rateWei],
    }),
  });

  const deposit = Math.max(0, xnum(depositStr));
  const multiplier = multiplierBps / 10_000;
  const spyPrice = !oraclePrice.isError && oraclePrice.data ? Number(formatUnits(oraclePrice.data, 18)) : 0;
  const exposure = Number(formatUnits(amounts.totalCollateral, 18));
  const principalDebt = Number(formatUnits(boldAmount, 18));
  const fee = Number(formatUnits(upfrontFee.data ?? 0n, 18));
  const totalDebt = principalDebt + fee;
  const exposureUsd = exposure * spyPrice;
  const ltv = exposureUsd > 0 ? totalDebt / exposureUsd : 0;
  const liquidationPrice = exposure > 0 ? MIN_COLLATERAL_RATIO * totalDebt / exposure : 0;
  const walletBalance = chainState.data ? Number(formatUnits(chainState.data.balance, 18)) : 0;
  const insufficientSpy = Boolean(chainState.data && chainState.data.balance < depositWei);
  const insufficientEth = Boolean(chainState.data && chainState.data.nativeBalance < LIQUIDATOR_COMPENSATION_WETH);
  const unsafe = boldAmount > 0n && !isMultiplyCollateralSafe(
    amounts.totalCollateral, oraclePrice.data ?? 0n, boldAmount, maxUpfrontFee(upfrontFee.data ?? 0n),
  );
  const invalidData = oraclePrice.isError || swapQuote.isError || chainState.isError || upfrontFee.isError
    || !oraclePrice.data || !swapQuote.data || !chainState.data || upfrontFee.data === undefined;
  const belowMinimumDebt = boldAmount > 0n && boldAmount < MIN_DEBT;
  const pending = stage !== 'idle';
  const active = depositWei > 0n && boldAmount > 0n;
  // Before a deposit is entered there is no quote, so the risk and the
  // liquidation price come from the multiple alone: the debt is the
  // flash-loaned share of the exposure.
  const plannedLtv = (multiplier - 1) / multiplier;
  const shownLtv = active ? ltv : plannedLtv;
  const shownLiquidationPrice = active ? liquidationPrice : spyPrice * MIN_COLLATERAL_RATIO * plannedLtv;
  const riskLevel = liquidationRisk(shownLtv, MAX_LTV);

  function setMultiple(bps: number) {
    const clamped = Math.min(MAX_MULTIPLIER_BPS, Math.max(MIN_MULTIPLIER_BPS, Math.round(bps)));
    setMultiplierBps(clamped);
  }

  function setLiquidationPrice(value: string) {
    setLiquidationDraft(value);
    const target = xnum(value);
    const multiple = multiplierForLiquidationPrice(target, spyPrice, MIN_COLLATERAL_RATIO);
    if (multiple !== null) setMultiple(multiple * 10_000);
  }

  async function openMultiplyPosition() {
    if (!wallet.connected || !account || !wallet.provider) {
      try {
        await wallet.connect();
      } catch (cause) {
        setError(errorMessage(cause));
      }
      return;
    }
    if (!zapperAddress || !exchangeAddress || !zapperConfigured) {
      setError('Multiply is not configured for this deployment.');
      return;
    }
    if (!active || invalidData || pending || unsafe || belowMinimumDebt || insufficientSpy || insufficientEth) return;

    setError(null);
    setTxHash(null);
    setOpenedPosition(null);
    try {
      setStage('switching');
      await ensureRobinhoodTestnet(wallet.provider);

      // Verify the spender and exchange identities before asking for any approval.
      const [{ balance, allowance, nativeBalance }, initialQuote, troveCount] = await Promise.all([
        readWalletState(),
        quoteMultiply(publicClient, exchangeAddress, BORROW_CONTRACTS, amounts.flashLoanAmount),
        publicClient.readContract({ address: BORROW_CONTRACTS.sortedTroves, abi: sortedTrovesAbi, functionName: 'size' }),
      ]);
      if (initialQuote.boldAmount < MIN_DEBT) throw new Error('The loop must borrow at least 1,000 FUSD.');
      if (balance < depositWei) throw new Error('Your wallet does not have enough SPY.');
      if (nativeBalance < LIQUIDATOR_COMPENSATION_WETH) {
        throw new Error('You need 0.001 ETH plus network fees for liquidator compensation.');
      }

      let upperHint = 0n;
      let lowerHint = 0n;
      if (troveCount > 0n) {
        const approxHint = await getApproxHintBatched(publicClient, rateWei, troveCount);
        [upperHint, lowerHint] = await publicClient.readContract({
          address: BORROW_CONTRACTS.sortedTroves,
          abi: sortedTrovesAbi,
          functionName: 'findInsertPosition',
          args: [rateWei, approxHint, approxHint],
        });
      }

      const walletClient = createWalletClient({
        account,
        chain: robinhoodTestnet,
        transport: custom(wallet.provider),
      });

      if (allowance < depositWei) {
        setStage('approving');
        const approval = await publicClient.simulateContract({
          account,
          address: BORROW_CONTRACTS.spyToken,
          abi: erc20Abi,
          functionName: 'approve',
          args: [zapperAddress, depositWei],
        });
        const approvalHash = await walletClient.writeContract(approval.request);
        setTxHash(approvalHash);
        setStage('confirming');
        const receipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash });
        if (receipt.status !== 'success') throw new Error('The SPY approval transaction reverted.');
      }

      // Hints and wallet approval can take minutes: do not submit their old quote/fee/oracle.
      const [freshQuote, oracleSimulation, freshWallet] = await Promise.all([
        quoteMultiply(publicClient, exchangeAddress, BORROW_CONTRACTS, amounts.flashLoanAmount),
        publicClient.simulateContract({ address: BORROW_CONTRACTS.spyPriceFeed, abi: priceFeedAbi, functionName: 'fetchPrice' }),
        readWalletState(),
      ]);
      if (freshWallet.balance < depositWei || freshWallet.allowance < depositWei
        || freshWallet.nativeBalance < LIQUIDATOR_COMPENSATION_WETH) {
        throw new Error('Wallet balance or SPY allowance changed. Please retry.');
      }
      const submittedBoldAmount = freshQuote.boldAmount;
      const freshPrice = validatedOraclePrice(oracleSimulation.result);
      const predictedFee = await publicClient.readContract({
        address: BORROW_CONTRACTS.hintHelpers, abi: hintHelpersAbi,
        functionName: 'predictOpenTroveUpfrontFee', args: [0n, submittedBoldAmount, rateWei],
      });
      const feeCeiling = maxUpfrontFee(predictedFee);
      if (submittedBoldAmount < MIN_DEBT) throw new Error('The loop must borrow at least 1,000 FUSD.');
      if (!isMultiplyCollateralSafe(amounts.totalCollateral, freshPrice, submittedBoldAmount, feeCeiling)) {
        throw new Error('The refreshed position is below the 110% minimum collateral ratio at the fee ceiling.');
      }

      const params = {
        owner: account,
        ownerIndex: randomOwnerIndex(),
        collAmount: depositWei,
        flashLoanAmount: amounts.flashLoanAmount,
        boldAmount: submittedBoldAmount,
        upperHint,
        lowerHint,
        annualInterestRate: rateWei,
        batchManager: zeroAddress,
        maxUpfrontFee: feeCeiling,
        addManager: zeroAddress,
        removeManager: zeroAddress,
        receiver: zeroAddress,
      } as const;

      setStage('opening');
      const simulation = await publicClient.simulateContract({
        account,
        address: zapperAddress,
        abi: leverageZapperAbi,
        functionName: 'openLeveragedTroveWithSPY',
        args: [params],
        value: LIQUIDATOR_COMPENSATION_WETH,
      });
      const hash = await walletClient.writeContract(simulation.request);
      setTxHash(hash);
      setStage('confirming');
      let replacementInvalid = false;
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        onReplaced: replacement => {
          if (replacement.reason !== 'repriced') replacementInvalid = true;
          setTxHash(replacement.transaction.hash);
        },
      });
      if (replacementInvalid) throw new Error('The transaction was cancelled or replaced.');
      if (receipt.status !== 'success') throw new Error('The multiply transaction reverted.');
      pendingPositions.confirm(account, BORROW_CONTRACTS.troveManager, receipt);
      setOpenedPosition(positionsFromReceipt(account, BORROW_CONTRACTS.troveManager, receipt)[0] ?? null);
      await chainState.refetch();
      setComplete(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setStage('idle');
    }
  }

  if (complete && txHash) {
    return (
      <div className="swap">
        <div className="swap__done">
          <span className="swap__done-mark" aria-hidden="true">✓</span>
          <h2>Multiply position opened</h2>
          <p>{money(deposit, 4)} SPY was multiplied to approximately {money(exposure, 4)} SPY of exposure.</p>
          <Link className="btn btn--primary" href="/stability">Earn with position →</Link>
          {openedPosition && openedPosition.owner.toLowerCase() === wallet.address?.toLowerCase() && (
            <Link className="btn btn--primary" href={managePositionHref(openedPosition)}>Manage position →</Link>
          )}
          <a
            className="btn btn--transaction"
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
          ? 'Confirm multiply in wallet…'
          : stage === 'confirming'
            ? 'Waiting for confirmation…'
            : 'Multiply SPY →';

  return (
    <div className="swap">
      <h1 className="swap__title">
        <span>Multiply</span>
        <span className="swap__pair"><TokenIcon symbol="SPY" size={30} /><span className="swap__tok">SPY</span></span>
        <span>with</span>
        <span className="swap__pair"><TokenIcon symbol="FUSD" size={30} /><span className="swap__tok">FUSD</span></span>
      </h1>

      <div className="swap__field">
        <span className="swap__label">Your SPY deposit</span>
        <div className="swap__row">
          <input className="swap__amount" inputMode="decimal" placeholder="0.00" value={depositStr}
            onChange={(event) => setDepositStr(event.target.value)} aria-label="SPY deposit" />
          <span className="swap__pill"><Token symbol="SPY" size={18} /></span>
        </div>
        <span className="swap__usd">
          ${money(deposit * spyPrice)} · wallet {wallet.connected ? `${money(walletBalance, 4)} SPY` : 'not connected'}
        </span>
      </div>
      <div className="swap__meta">
        <span>
          Oracle price <b>{spyPrice > 0 ? `$${money(spyPrice)}` : oraclePrice.isError ? 'unavailable' : 'loading…'}</b>{' '}
          {spyPrice > 0 && <><i className="swap__dot swap__dot--ok" /> onchain</>}
        </span>
        <span>Max LTV <b>{pct(MAX_LTV * 100, 1)}</b></span>
      </div>

      <div className="swap__field lev">
        <div className="swap__row">
          <span className="swap__label">{sizeBy === 'liquidation' ? 'Liquidation price' : 'Multiplier'}</span>
          <span className="seg" role="group" aria-label="Size the position by">
            {(['liquidation', 'multiplier'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={sizeBy === option ? 'seg__opt seg__opt--on' : 'seg__opt'}
                aria-pressed={sizeBy === option}
                onClick={() => {
                  setSizeBy(option);
                  setLiquidationDraft(null);
                }}
              >
                {option === 'liquidation' ? 'Liq. price' : 'Multiplier'}
              </button>
            ))}
          </span>
        </div>
        <div className="swap__row">
          {sizeBy === 'liquidation' ? (
            <span className="lev__price">
              <span aria-hidden="true">$</span>
              <input
                className="swap__amount"
                inputMode="decimal"
                placeholder="0.00"
                value={liquidationDraft ?? (shownLiquidationPrice > 0 ? shownLiquidationPrice.toFixed(2) : '')}
                onChange={(event) => setLiquidationPrice(event.target.value.replaceAll(',', ''))}
                onBlur={() => setLiquidationDraft(null)}
                disabled={pending || !(spyPrice > 0)}
                aria-label="Liquidation price"
              />
            </span>
          ) : (
            <span className="swap__amount swap__amount--rate">{multiplier.toFixed(1)}x</span>
          )}
        </div>
        <div className="lev__slider">
          <input
            className="lev__range"
            type="range"
            min={MIN_MULTIPLIER_BPS}
            max={MAX_MULTIPLIER_BPS}
            step={MULTIPLIER_STEP_BPS}
            value={Math.round(multiplierBps / MULTIPLIER_STEP_BPS) * MULTIPLIER_STEP_BPS}
            onChange={(event) => {
              setLiquidationDraft(null);
              setMultiple(Number(event.target.value));
            }}
            disabled={pending}
            style={{ '--lev-track': TRACK_STOPS } as React.CSSProperties}
            aria-label="Multiplier"
            aria-valuetext={`${multiplier.toFixed(2)}x`}
          />
          <div className="lev__ticks" aria-hidden="true">
            {MULTIPLIER_TICKS.map((tick) => (
              <span key={tick} style={{ left: `${sliderPosition(tick)}%` }}>{(tick / 10_000).toString()}x</span>
            ))}
          </div>
        </div>
        <div className="swap__row lev__foot">
          <span className="swap__usd">
            {sizeBy === 'liquidation'
              ? `Multiplier ${multiplier.toFixed(2)}x`
              : `Liquidation price ${shownLiquidationPrice > 0 ? `$${money(shownLiquidationPrice)}` : '−'}`}
          </span>
          <span className="swap__usd">SPY price {spyPrice > 0 ? `$${money(spyPrice)}` : '−'}</span>
        </div>
      </div>
      <div className="swap__meta">
        <span className={`risk-tag risk-tag--${unsafe ? 'high' : riskLevel}`}>
          <i className={`swap__dot swap__dot--${unsafe ? 'high' : riskLevel}`} />
          {RISK_LABEL[unsafe ? 'high' : riskLevel]} liquidation risk
        </span>
        <span>LTV <b>{pct(shownLtv * 100, 1)}</b></span>
      </div>
      <div className="swap__meta">
        <span>FUSD debt <b>{active ? money(totalDebt, 2) : '−'}</b></span>
        <span>Total SPY exposure <b>{active ? `${money(exposure, 4)} SPY` : '−'}</b></span>
      </div>

      <div className="swap__field swap__field--rate">
        <div className="swap__row">
          <span className="swap__label">Set interest rate</span>
          <span className="swap__amount swap__amount--rate">{pct(rate * 100, 2)}</span>
        </div>
        <input className="slider swap__slider" type="range" min={MIN_RATE} max={MAX_RATE} step={0.0025}
          value={rate} onChange={(event) => setRate(Number(event.target.value))} aria-label="Interest rate" />
        <span className="swap__usd">${money(totalDebt * rate)} FUSD / year</span>
      </div>

      <details className="swap__note">
        <summary>How does Multiply work?</summary>
        <p>
          Multiply borrows FUSD against your SPY and uses it to buy more SPY, all in one transaction.
          At 2x, a deposit of 10 SPY gives you exposure to 20 SPY.
        </p>
        <p>
          More exposure means bigger gains and losses, and a liquidation price closer to today&apos;s
          price. You can add SPY or repay FUSD from the Manage page at any time.
        </p>
      </details>

      {!zapperConfigured && <p className="warn">Multiply is disabled. Configure the SPY leverage zapper and mock exchange addresses.</p>}
      {unsafe && <p className="warn">This position is below the protocol&apos;s 110% minimum collateral ratio.</p>}
      {belowMinimumDebt && <p className="warn">The loop must borrow at least 1,000 FUSD.</p>}
      {insufficientSpy && <p className="warn">Your wallet does not have enough SPY for this deposit.</p>}
      {insufficientEth && <p className="warn">You need 0.001 ETH plus network fees for liquidator compensation.</p>}
      {oraclePrice.isError && <p className="warn">The SPY oracle is unavailable. Multiply is disabled.</p>}
      {swapQuote.isError && <p className="warn">Could not quote the FUSD → SPY loop: {errorMessage(swapQuote.error)}</p>}
      {chainState.isError && <p className="warn">Could not verify the Multiply deployment or wallet state.</p>}
      {upfrontFee.isError && <p className="warn">Could not quote the upfront fee. Try again before submitting.</p>}
      {error && <p className="warn" role="alert">{error}</p>}
      {txHash && pending && (
        <p className="swap__usd"><a href={`${robinhoodTestnet.blockExplorers.default.url}/tx/${txHash}`} target="_blank" rel="noreferrer">View pending transaction ↗</a></p>
      )}

      <Button
        variant="primary"
        disabled={wallet.connected && (!zapperConfigured || !active || unsafe || belowMinimumDebt || insufficientSpy || insufficientEth || pending || invalidData)}
        onClick={() => void openMultiplyPosition()}
      >
        {buttonLabel}
      </Button>
    </div>
  );
}
