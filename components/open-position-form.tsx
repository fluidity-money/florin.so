'use client';
import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { TokenSelect } from './token-select';
import { money, pct, xnum } from '../lib/format';
import {
  DEFAULT_RATE,
  MAX_RATE,
  MIN_COLLATERAL_RATIO,
  MIN_RATE,
} from '../lib/protocol-constants';
import { parseDisplayPercent, spyMarket, type FlorinMarkets } from '../lib/florin-markets';
import { useFlorinMarkets } from '../lib/use-florin-markets';
import {
  describeTransactionError,
  type TransactionErrorDescription,
  type TransactionFailureStage,
} from '../lib/transaction-error';
import { useWallet } from './wallet/wallet';
import useAccount from '../hooks/useAccount';
import useFeature from '../hooks/useFeature';
import { captureEvent } from '../lib/analytics';
import {
  borrowerOperationsAbi,
  CONTRACTS,
  erc20Abi,
  getApproxHintBatched,
  LIQUIDATOR_COMPENSATION_WETH,
  randomOwnerIndex,
  requiredSpyApproval,
  requiredWethWrap,
  ROBINHOOD_TESTNET_CHAIN_ID,
  sortedTrovesAbi,
  wethAbi,
} from '../lib/borrow-contract';

import { quoteOpening, requireOpeningQuote, reviewOpeningRefresh, validateOpeningAmount, formatOpeningMax } from '../lib/opening-capacity';

const publicClient = createPublicClient({ chain: robinhoodTestnet, transport: http() });


type TxStage = 'idle' | 'switching' | 'wrapping' | 'approving-weth' | 'approving' | 'opening' | 'confirming';

const LOAN_TOKENS = ['FUSD', 'USDG'] as const;
type LoanToken = (typeof LOAN_TOKENS)[number];

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

export function OpenPositionForm({ initialMarkets }: { initialMarkets: FlorinMarkets }) {
  const wallet = useWallet();
  const enableAccounts = useFeature('enable-accounts');
  const { createAccountFlorinOpenPosition } = useAccount();
  const markets = useFlorinMarkets(initialMarkets);
  const { borrow: spyMarketDetails } = spyMarket(markets);
  const marketAverageRate = parseDisplayPercent(spyMarketDetails?.avgRatePa);
  const account = wallet.address as Address | null;
  const [spyStr, setSpyStr] = useState('');
  const [debtStr, setDebtStr] = useState('');
  const [rate, setRate] = useState(DEFAULT_RATE);
  // USDG is offered ahead of support for it: picking it shows the loan in USDG
  // and holds the submit button disabled until borrowing USDG is wired up.
  const [loanToken, setLoanToken] = useState<LoanToken>('FUSD');
  const usdgSelected = loanToken === 'USDG';
  const [stage, setStage] = useState<TxStage>('idle');
  const [error, setError] = useState<TransactionErrorDescription | null>(null);
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [minted, setMinted] = useState(false);
  const formStarted = useRef(false);

  function markFormStarted(firstField: 'collateral' | 'borrow_amount' | 'interest_rate') {
    if (formStarted.current) return;
    formStarted.current = true;
    captureEvent('position_open_form_started', {
      first_field: firstField,
      wallet_connected: wallet.connected,
      market_data_available: Boolean(spyMarketDetails),
    });
  }

  const collateralWei = useMemo(() => parseToken(spyStr), [spyStr]);
  const borrowedWei = useMemo(() => parseToken(debtStr), [debtStr]);
  const rateWei = BigInt(Math.round(rate * 1e18));

  const queryClient = useQueryClient();
  const openingKey = ['opening-capacity', collateralWei.toString(), borrowedWei.toString(), rateWei.toString()];
  const openingQuote = useQuery({
    queryKey: openingKey,
    refetchInterval: 15_000,
    retry: false,
    queryFn: () => quoteOpening(publicClient, collateralWei, borrowedWei, rateWei),
  });
  let quoteReady = false;
  try { requireOpeningQuote(openingQuote); quoteReady = true; } catch { /* fail closed */ }
  const quote = openingQuote.data;

  // Balance and allowance are the parts that genuinely need an address.
  const chainState = useQuery({
    queryKey: ['open-trove-state', account],
    enabled: Boolean(account),
    refetchInterval: 15_000,
    queryFn: async () => {
      const [balance, allowance] = await Promise.all([
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
      ]);
      return { balance, allowance };
    },
  });

  const priceReady = quoteReady;
  const chainReady = Boolean(chainState.data) && quoteReady;
  const feeReady = quoteReady;
  const spyPrice = quote ? Number(formatUnits(quote.price, 18)) : 0;
  const spy = Math.max(0, xnum(spyStr));
  const borrow = Math.max(0, xnum(debtStr));
  const fee = Number(formatUnits(quote?.fee ?? 0n, 18));
  const totalDebt = borrow + fee;
  const collateralUsd = spy * spyPrice;
  const collateralRatio = totalDebt > 0 ? collateralUsd / totalDebt : 0;
  const ltv = collateralUsd > 0 ? totalDebt / collateralUsd : 0;
  const maxBorrowWei = quote?.maxPrincipal ?? 0n;
  const minimumRatio = quote ? Number(formatUnits(quote.mcr, 18)) : MIN_COLLATERAL_RATIO;
  const liquidationPrice = spy > 0 && totalDebt > 0 ? minimumRatio * totalDebt / spy : 0;
  const annualInterest = totalDebt * rate;
  const redemptionRisk = marketAverageRate === null
    ? null
    : rate >= marketAverageRate
      ? 'low'
      : rate >= marketAverageRate * 0.6
        ? 'medium'
        : 'high';
  const pending = stage !== 'idle';
  const walletBalance = chainState.data ? Number(formatUnits(chainState.data.balance, 18)) : 0;
  const protocolError = quoteReady && quote ? validateOpeningAmount(collateralWei, borrowedWei, rateWei, quote.fee, quote.capacity) : null;
  const insufficientSpy = chainState.data
    ? chainState.data.balance < requiredSpyApproval(collateralWei)
    : false;
  const unsafe = quoteReady && quote ? borrowedWei + quote.fee > quote.capacity : false;
  const active = collateralWei > 0n && borrowedWei > 0n;

  function reportError(cause: unknown, failureStage: TransactionFailureStage, transactionHash: Hash | null = null) {
    const description = describeTransactionError(cause, failureStage);
    setError(description);

    captureEvent('position_open_failed', {
      failure_stage: description.stage,
      error_title: description.title,
      error_code: description.code,
      chain_id: ROBINHOOD_TESTNET_CHAIN_ID,
      wallet_kind: wallet.kind,
      had_transaction: transactionHash !== null,
    });
  }

  async function openTrove() {
    if (!wallet.connected || !account || !wallet.provider) {
      setError(null);
      try {
        await wallet.connect();
      } catch (cause) {
        reportError(cause, 'connecting');
      }
      return;
    }
    if (pending || protocolError || unsafe || insufficientSpy || !quoteReady || chainState.isError) return;

    captureEvent('position_open_requested', {
      chain_id: ROBINHOOD_TESTNET_CHAIN_ID,
      wallet_kind: wallet.kind,
      redemption_risk: redemptionRisk,
    });
    setError(null);
    setTxHash(null);
    let failureStage: TransactionFailureStage = 'switching';
    let transactionHash: Hash | null = null;
    try {
      setStage('switching');
      await ensureRobinhoodTestnet(wallet.provider);
      failureStage = 'preparing';
      const reviewed = requireOpeningQuote(openingQuote);
      // Re-read before approvals, and again after all approval/hint work. Never
      // silently alter the principal, even when the newly available Max changes.
      const refreshOpening = async () => {
        const fresh = await quoteOpening(publicClient, collateralWei, borrowedWei, rateWei);
        queryClient.setQueryData(openingKey, fresh);
        return reviewOpeningRefresh(reviewed, fresh, collateralWei, borrowedWei, rateWei);
      };
      await refreshOpening();
      const requiredApproval = requiredSpyApproval(collateralWei);
      const directStatePromise = enableAccounts
        ? Promise.resolve(null)
        : Promise.all([
          publicClient.readContract({
            address: CONTRACTS.spyToken,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [account, CONTRACTS.borrowerOperations],
          }),
          publicClient.readContract({
            address: CONTRACTS.weth,
            abi: wethAbi,
            functionName: 'balanceOf',
            args: [account],
          }),
          publicClient.readContract({
            address: CONTRACTS.weth,
            abi: wethAbi,
            functionName: 'allowance',
            args: [account, CONTRACTS.borrowerOperations],
          }),
          publicClient.getBalance({ address: account }),
        ]);
      const [balance, troveCount, directState] = await Promise.all([
        publicClient.readContract({
          address: CONTRACTS.spyToken,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account],
        }),
        publicClient.readContract({
          address: CONTRACTS.sortedTroves,
          abi: sortedTrovesAbi,
          functionName: 'size',
        }),
        directStatePromise,
      ]);

      if (balance < requiredApproval) {
        throw new Error(`You need ${formatUnits(requiredApproval, 18)} SPY for this position.`);
      }

      if (enableAccounts) {
        let upperHint = 0n;
        let lowerHint = 0n;
        if (troveCount > 0n) {
          const approxHint = await getApproxHintBatched(publicClient, rateWei, troveCount);
          [upperHint, lowerHint] = await publicClient.readContract({
            address: CONTRACTS.sortedTroves,
            abi: sortedTrovesAbi,
            functionName: 'findInsertPosition',
            args: [rateWei, approxHint, approxHint],
          });
        }

        const feeLimit = await refreshOpening();
        failureStage = 'opening';
        setStage('opening');
        const ownerIndex = randomOwnerIndex();
        const result = await createAccountFlorinOpenPosition({
          openPosition: {
            owner: account,
            asset: 'SPY',
            collateralAmt: collateralWei.toString(),
            boldAmt: borrowedWei.toString(),
            annualInterestRate: rateWei.toString(),
            ownerIndex: ownerIndex.toString(),
            maxUpfrontFee: feeLimit.toString(),
            lowerHint: lowerHint.toString(),
            upperHint: upperHint.toString(),
            receiver: account,
          },
          gasToken: 'SPY',
          gasTokenAmt: '0',
          dryrun: false,
        });
        if (!/^0x[0-9a-fA-F]{64}$/.test(result.hash)) {
          throw new Error('The account service returned an invalid transaction hash.');
        }
        const hash = result.hash as Hash;
        transactionHash = hash;
        setTxHash(hash);
        failureStage = 'confirming';
        setStage('confirming');
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') throw new Error('The account open-position transaction reverted.');

        await chainState.refetch();
        captureEvent('position_open_succeeded', {
          chain_id: ROBINHOOD_TESTNET_CHAIN_ID,
          wallet_kind: wallet.kind,
          redemption_risk: redemptionRisk,
        });
        setMinted(true);
        return;
      }

      if (!directState) throw new Error('Direct wallet state was not loaded.');
      const [allowance, wethBalance, wethAllowance, nativeBalance] = directState;
      const walletClient = createWalletClient({
        account,
        chain: robinhoodTestnet,
        transport: custom(wallet.provider),
      });

      const wethToWrap = requiredWethWrap(wethBalance);
      if (wethToWrap > 0n) {
        if (nativeBalance < wethToWrap) {
          throw new Error(`Not enough funds. You need ${formatUnits(wethToWrap, 18)} ETH plus network fees to fund the liquidator compensation.`);
        }
        failureStage = 'wrapping';
        setStage('wrapping');
        const wrap = await publicClient.simulateContract({
          account,
          address: CONTRACTS.weth,
          abi: wethAbi,
          functionName: 'deposit',
          value: wethToWrap,
        });
        const wrapHash = await walletClient.writeContract(wrap.request);
        transactionHash = wrapHash;
        setTxHash(wrapHash);
        setStage('confirming');
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: wrapHash,
          onReplaced: (replacement) => {
            transactionHash = replacement.transaction.hash;
            setTxHash(transactionHash);
          },
        });
        if (receipt.status !== 'success') throw new Error('The ETH wrapping transaction reverted.');
        transactionHash = null;
      }

      if (wethAllowance < LIQUIDATOR_COMPENSATION_WETH) {
        failureStage = 'approving-weth';
        setStage('approving-weth');
        const approval = await publicClient.simulateContract({
          account,
          address: CONTRACTS.weth,
          abi: wethAbi,
          functionName: 'approve',
          args: [CONTRACTS.borrowerOperations, LIQUIDATOR_COMPENSATION_WETH],
        });
        const approvalHash = await walletClient.writeContract(approval.request);
        transactionHash = approvalHash;
        setTxHash(approvalHash);
        setStage('confirming');
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: approvalHash,
          onReplaced: (replacement) => {
            transactionHash = replacement.transaction.hash;
            setTxHash(transactionHash);
          },
        });
        if (receipt.status !== 'success') throw new Error('The WETH approval transaction reverted.');
        transactionHash = null;
      }

      let upperHint = 0n;
      let lowerHint = 0n;
      if (troveCount > 0n) {
        const approxHint = await getApproxHintBatched(publicClient, rateWei, troveCount);
        [upperHint, lowerHint] = await publicClient.readContract({
          address: CONTRACTS.sortedTroves,
          abi: sortedTrovesAbi,
          functionName: 'findInsertPosition',
          args: [rateWei, approxHint, approxHint],
        });
      }

      if (allowance < requiredApproval) {
        failureStage = 'approving';
        setStage('approving');
        const approval = await publicClient.simulateContract({
          account,
          address: CONTRACTS.spyToken,
          abi: erc20Abi,
          functionName: 'approve',
          args: [CONTRACTS.borrowerOperations, requiredApproval],
        });
        const approvalHash = await walletClient.writeContract(approval.request);
        transactionHash = approvalHash;
        setTxHash(approvalHash);
        setStage('confirming');
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: approvalHash,
          onReplaced: (replacement) => {
            transactionHash = replacement.transaction.hash;
            setTxHash(transactionHash);
          },
        });
        if (receipt.status !== 'success') throw new Error('The SPY approval transaction reverted.');
        transactionHash = null;
      }

      const feeLimit = await refreshOpening();
      failureStage = 'opening';
      setStage('opening');
      const ownerIndex = randomOwnerIndex();
      const simulation = await publicClient.simulateContract({
        account,
        address: CONTRACTS.borrowerOperations,
        abi: borrowerOperationsAbi,
        functionName: 'openTrove',
        args: [
          account,
          ownerIndex,
          collateralWei,
          borrowedWei,
          upperHint,
          lowerHint,
          rateWei,
          feeLimit,
          zeroAddress,
          zeroAddress,
          zeroAddress,
        ],
      });
      const hash = await walletClient.writeContract(simulation.request);
      transactionHash = hash;
      setTxHash(hash);
      failureStage = 'confirming';
      setStage('confirming');
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        onReplaced: (replacement) => {
          transactionHash = replacement.transaction.hash;
          setTxHash(transactionHash);
        },
      });
      if (receipt.status !== 'success') throw new Error('The open-trove transaction reverted.');

      await chainState.refetch();
      captureEvent('position_open_succeeded', {
        chain_id: ROBINHOOD_TESTNET_CHAIN_ID,
        wallet_kind: wallet.kind,
        redemption_risk: redemptionRisk,
      });
      setMinted(true);
    } catch (cause) {
      reportError(cause, failureStage, transactionHash);
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
      : stage === 'wrapping'
        ? 'Wrap ETH in wallet…'
        : stage === 'approving-weth'
          ? 'Approve WETH in wallet…'
          : stage === 'approving'
            ? 'Approve SPY in wallet…'
            : stage === 'opening'
              ? 'Confirm position in wallet…'
              : stage === 'confirming'
                ? 'Waiting for confirmation…'
                : 'Mint FUSD →';
  const submitLabel = usdgSelected ? 'Borrow USDG' : buttonLabel;

  return (
    <div className="swap">
      <h1 className="swap__title">
        <span>Borrow</span>
        <span className="swap__pair"><TokenIcon symbol={loanToken} size={30} /><span className="swap__tok">{loanToken}</span></span>
        <span>with</span>
        <span className="swap__pair"><TokenIcon symbol="SPY" size={30} /><span className="swap__tok">SPY</span></span>
      </h1>

      <div className="swap__field">
        <span className="swap__label">Collateral</span>
        <div className="swap__row">
          <input disabled={pending} className="swap__amount" inputMode="decimal" placeholder="0.00" value={spyStr}
            onChange={(event) => {
              markFormStarted('collateral');
              setSpyStr(event.target.value);
            }} aria-label="SPY collateral" />
          <span className="swap__pill"><Token symbol="SPY" size={18} /></span>
        </div>
        <span className="swap__usd">
          ${money(collateralUsd)} · wallet {wallet.connected ? `${money(walletBalance, 4)} SPY` : 'not connected'}
        </span>
      </div>
      <div className="swap__meta">
        <span>
          Oracle price <b>{priceReady ? `$${money(spyPrice)}` : openingQuote.isError ? 'unavailable' : 'loading…'}</b>{' '}
          {priceReady && <><i className="swap__dot swap__dot--ok" /> onchain</>}
        </span>
        <span>Individual max LTV <b>{quoteReady ? pct(100 / minimumRatio, 1) : '−'}</b></span>
      </div>

      <div className="swap__field">
        <span className="swap__label">Loan</span>
        <div className="swap__row">
          <input disabled={pending} className="swap__amount" inputMode="decimal" placeholder="10.00" value={debtStr}
            onChange={(event) => {
              markFormStarted('borrow_amount');
              setDebtStr(event.target.value.replaceAll(',', ''));
            }} aria-label={`${loanToken} to borrow`} />
          <button
            type="button"
            className="swap__max"
            disabled={pending || !quoteReady || maxBorrowWei <= 0n}
            onClick={() => {
              captureEvent('max_amount_selected', { context: 'open_position', asset: loanToken });
              try {
                const current = requireOpeningQuote(openingQuote);
                setDebtStr(formatOpeningMax(current.maxPrincipal));
              } catch (cause) { reportError(cause, 'preparing'); }
            }}
          >
            Max
          </button>
          <TokenSelect
            options={LOAN_TOKENS}
            value={loanToken}
            label="Token to borrow"
            onChange={(symbol) => {
              if (symbol !== loanToken) captureEvent('loan_token_selected', { context: 'open_position', asset: symbol });
              setLoanToken(symbol);
            }}
          />
        </div>
        <span className="swap__usd">
          ${money(borrow)} received{fee > 0 ? ` · ${money(totalDebt)} debt including ${money(fee)} upfront interest` : ''}
        </span>
      </div>
      <div className="swap__meta">
        <span><i className={`swap__dot swap__dot--${unsafe ? 'liquidation' : collateralRatio < 1.3 && active ? 'warning' : 'healthy'}`} /> Liquidation risk</span>
        <span>Current max borrow <b>{quoteReady && spy > 0 ? `${formatOpeningMax(maxBorrowWei)} FUSD` : '−'}</b></span>
      </div>
      <div className="swap__meta swap__meta--right">
        <span>Liquidation price <b>{active ? `$${money(liquidationPrice)}` : '−'}</b></span>
      </div>
      <div className="swap__meta swap__meta--right">
        <span>LTV <b>{active ? pct(ltv * 100, 1) : '−'}</b>{active && <em> ({pct(collateralRatio * 100, 0)} CR)</em>}</span>
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
            value={rate} onChange={(event) => {
              markFormStarted('interest_rate');
              setRate(parseFloat(event.target.value));
            }} aria-label="Interest rate" />
        </div>
        <span className="swap__usd">${money(annualInterest)} {loanToken} / year</span>
      </div>
      {/* The right-hand slot used to show a redemption-queue amount:
          the debt sitting on cheaper rates, and so ahead of this position in
          the redemption queue. That needs a rate distribution, and the graph
          exposes only an aggregate average plus openPositions(owner), which
          cannot enumerate other people's positions. Left out rather than
          approximated, and the average now lives in the field's own label so
          it is not repeated here. */}
      <div className="swap__meta">
        {redemptionRisk ? (
          <span><i className={`swap__dot swap__dot--${redemptionRisk}`} /> {redemptionRisk} redemption risk</span>
        ) : (
          <span>Market average rate unavailable</span>
        )}
      </div>

      <details className="swap__note">
        <summary>What happens when you open a position?</summary>
        <p>Your wallet wraps up to 0.001 ETH into WETH and approves it for liquidator compensation. It separately approves the exact SPY collateral, then opens the position and mints FUSD.</p>
        <p>Max includes the upfront fee and the live branch collateral requirement. It is a boundary, not a guarantee: price and accrued debt can change before execution. If your amount no longer fits, you must review it before submitting.</p>
        <p>Your interest rate also determines your place in the redemption queue: lower-rate positions are redeemed first.</p>
      </details>

      {protocolError && active && <p className="warn">{protocolError}</p>}
      {unsafe && <p className="warn">This amount exceeds the current individual or branch borrowing limit.</p>}
      {quoteReady && collateralWei > 0n && maxBorrowWei === 0n && (
        <p className="warn">No opening amount at cent precision meets the minimum debt and current collateral limits. Increase your collateral.</p>
      )}
      {insufficientSpy && <p className="warn">Your wallet does not have enough testnet SPY for the collateral.</p>}
      {chainState.isError && <p className="warn">Could not read the Robinhood testnet contracts. Try again before submitting.</p>}
      {openingQuote.isError && <p className="warn">Live opening limits or the oracle are unavailable. Refresh before submitting.</p>}
      {error && (
        <div className="swap__error" role="alert">
          <p className="warn">{error.title}</p>
          <p className="swap__error-explanation">{error.explanation}</p>
          <details className="swap__error-details">
            <summary>Technical details</summary>
            <code>{error.technicalDetails}</code>
          </details>
        </div>
      )}
      {txHash && (pending || error) && (
        <p className="swap__usd">
          <a href={`${robinhoodTestnet.blockExplorers.default.url}/tx/${txHash}`} target="_blank" rel="noreferrer">
            {pending ? 'View pending transaction ↗' : 'View transaction details ↗'}
          </a>
        </p>
      )}

      <Button
        variant="primary"
        disabled={usdgSelected || (wallet.connected && (!active || Boolean(protocolError) || unsafe || insufficientSpy || pending || !chainReady || !feeReady || chainState.isError || openingQuote.isError))}
        onClick={() => {
          if (!usdgSelected) void openTrove();
        }}
      >
        {submitLabel}
      </Button>

      <RisksDialog />
    </div>
  );
}
