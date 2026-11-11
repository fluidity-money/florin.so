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
import { LeverageField, MAX_LTV } from './leverage-field';
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
  multiplyAmountsBps,
} from '../lib/multiply-contract';
import { liquidationRisk, redemptionRisk as redemptionRiskFor, type RiskLevel } from '../lib/protocol-math';
import { parseDisplayPercent, spyMarket, type FlorinMarkets } from '../lib/florin-markets';
import { useFlorinMarkets } from '../lib/use-florin-markets';

const publicClient = createPublicClient({ chain: robinhoodTestnet, transport: http() });
const RISK_LABEL: Record<RiskLevel, string> = { low: 'Low', medium: 'Medium', high: 'High' };

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

export function MultiplyForm({ initialMarkets }: { initialMarkets: FlorinMarkets }) {
  const markets = useFlorinMarkets(initialMarkets);
  const marketAverageRate = parseDisplayPercent(spyMarket(markets).borrow?.avgRatePa);
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
  const redemptionRisk = redemptionRiskFor(rate, marketAverageRate);


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

      <LeverageField
        multiplierBps={multiplierBps}
        onChange={setMultiplierBps}
        spyPrice={spyPrice}
        liquidationPrice={shownLiquidationPrice}
        disabled={pending}
      />
      <div className="swap__meta">
        <span className={`risk-tag risk-tag--${unsafe ? 'high' : riskLevel}`}>
          <i className={`swap__dot swap__dot--${unsafe ? 'high' : riskLevel}`} />
          {RISK_LABEL[unsafe ? 'high' : riskLevel]} liquidation risk
        </span>
        <span>LTV <b>{pct(shownLtv * 100, 1)}</b></span>
      </div>
      <div className="swap__meta swap__meta--right">
        <span>Exposure <b>{active ? `${money(exposure, 4)} SPY` : '−'}</b></span>
      </div>

      <div className="swap__field swap__field--rate">
        <div className="swap__row">
          <span className="swap__label">
            Set interest rate
            {marketAverageRate !== null && <em> (avg. {pct(marketAverageRate * 100, 2)})</em>}
          </span>
        </div>
        <div className="swap__row">
          <span className="swap__amount swap__amount--rate">{pct(rate * 100, 2)}</span>
          <input disabled={pending} className="slider swap__slider" type="range" min={MIN_RATE} max={MAX_RATE} step={0.0025}
            value={rate} onChange={(event) => setRate(Number(event.target.value))} aria-label="Interest rate" />
        </div>
        <span className="swap__usd">${money(totalDebt * rate)} FUSD / year</span>
      </div>
      <div className="swap__meta">
        {redemptionRisk ? (
          <span className={`risk-tag risk-tag--${redemptionRisk}`}>
            <i className={`swap__dot swap__dot--${redemptionRisk}`} />
            {RISK_LABEL[redemptionRisk]} redemption risk
          </span>
        ) : (
          <span>Market average rate unavailable</span>
        )}
      </div>

      <details className="swap__note">
        <summary>How does Multiply work?</summary>
        <p>
          Multiply borrows FUSD against your SPY and uses it to buy more SPY, all in one transaction.
          At 2x, a deposit of 10 SPY gives you exposure to 20 SPY.
        </p>
        <p>
          More exposure means bigger gains and losses, and a liquidation price closer to today&apos;s
          price.
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
