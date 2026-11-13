'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Token, TokenIcon } from './token-icon';
import { TokenSelect } from './token-select';
import { LoanTokenToggle } from './loan-token-toggle';
import { money, pct, xnum } from '../lib/format';
import { DEBT_SUGGESTIONS, liquidationRisk, redemptionRisk as redemptionRiskFor, type RiskLevel } from '../lib/protocol-math';
import {
  DEFAULT_RATE,
  MAX_RATE,
  MIN_COLLATERAL_RATIO,
  MIN_RATE,
} from '../lib/protocol-constants';
import { parseDisplayPercent, spyMarket, type FlorinMarkets } from '../lib/florin-markets';
import { useFlorinMarkets, useMarketAction } from '../lib/use-florin-markets';
import {
  describeTransactionError,
  type TransactionErrorDescription,
  type TransactionFailureStage,
} from '../lib/transaction-error';
import { useWallet } from './wallet/wallet';
import Link from 'next/link';
import { pendingPositions, positionsFromReceipt } from '../lib/pending-positions';
import { managePositionHref } from '../lib/position-navigation';
import type { FlorinPosition } from '../lib/florin-positions';
import { requireAuthorizedAccount } from '../lib/wallet-authorization';
import useAccount from '../hooks/useAccount';
import useFeature from '../hooks/useFeature';
import { captureEvent } from '../lib/analytics';
import {
  borrowerOperationsAbi,
  gasCompZapperAbi,
  prepareCollateralPermit,
  collateralPermitParams,
  CONTRACTS,
  erc20Abi,
  getApproxHintBatched,
  LIQUIDATOR_COMPENSATION_WETH,
  randomOwnerIndex,
  requiredSpyApproval,
  ROBINHOOD_TESTNET_CHAIN_ID,
  sortedTrovesAbi,
  MIN_DEBT,
} from '../lib/borrow-contract';

import { OPENING_MAX_AGE_MS, readOpeningState, quoteOpeningFromState, quoteOpening, requireOpeningQuote, reviewOpeningRefresh, validateOpeningAmount, formatOpeningMax } from '../lib/opening-capacity';

const publicClient = createPublicClient({ chain: robinhoodTestnet, transport: http() });


type TxStage = 'idle' | 'switching' | 'preparing' | 'signing-permit' | 'opening' | 'confirming';

const LOAN_TOKENS = ['FUSD', 'USDG'] as const;
type LoanToken = (typeof LOAN_TOKENS)[number];

const RISK_LABEL: Record<RiskLevel, string> = { low: 'Low', medium: 'Medium', high: 'High' };

// $850 / $5.7K / $1.2M. Short enough to sit on a suggestion chip.
function chipAmount(n: number): string {
  const trim = (value: number) => value.toFixed(1).replace(/\.0$/, '');
  if (n >= 1_000_000) return '$' + trim(n / 1_000_000) + 'M';
  if (n >= 1_000) return '$' + trim(n / 1_000) + 'K';
  return '$' + n.toFixed(0);
}

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
	const enableLoanTokenSpin = useFeature('enable-loan-token-spin', false);
  const { createAccountFlorinOpenPosition } = useAccount();
  const markets = useFlorinMarkets(initialMarkets);
  const prepareMarketAction = useMarketAction();
  const { borrow: spyMarketDetails } = spyMarket(markets);
  const marketAverageRate = parseDisplayPercent(spyMarketDetails?.avgRatePa);
  const account = wallet.address as Address | null;
  const [spyStr, setSpyStr] = useState('');
  const [debtStr, setDebtStr] = useState('');
	const [autoMaxLoan, setAutoMaxLoan] = useState<{
		account: Address | null;
		collateral: bigint;
	} | null>(null);
  const [rate, setRate] = useState(DEFAULT_RATE);
  // USDG is offered ahead of support for it: picking it shows the loan in USDG
  // and holds the submit button disabled until borrowing USDG is wired up.
  const [loanToken, setLoanToken] = useState<LoanToken>('FUSD');
	const [loanTokenIntro, setLoanTokenIntro] = useState(true);
  const usdgSelected = loanToken === 'USDG';
  const [stage, setStage] = useState<TxStage>('idle');
  const [error, setError] = useState<TransactionErrorDescription | null>(null);
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [minted, setMinted] = useState(false);
  const [openedPosition, setOpenedPosition] = useState<FlorinPosition | null>(null);
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
	const openingStateKey = ['opening-state', ROBINHOOD_TESTNET_CHAIN_ID, CONTRACTS.borrowerOperations, CONTRACTS.spyPriceFeed];
	const openingState = useQuery({
		queryKey: openingStateKey,
		queryFn: () => readOpeningState(publicClient),
		staleTime: 15_000,
		refetchInterval: 15_000,
		retry: false,
	});
	// Expire eligibility even if a refresh hangs and no other render occurs.
	const [, expireOpeningState] = useState(0);
	useEffect(() => {
		if (!openingState.data) return;
		const timer = setTimeout(() => {
			expireOpeningState(value => value + 1);
			void openingState.refetch({ cancelRefetch: false });
		}, Math.max(0, openingState.data.readAt + OPENING_MAX_AGE_MS + 1 - Date.now()));
		return () => clearTimeout(timer);
	}, [openingState.data, openingState.refetch]);
	let stateReady = false;
	try { requireOpeningQuote(openingState); stateReady = true; } catch { /* fail closed */ }
	const openingKey = ['opening-capacity', ROBINHOOD_TESTNET_CHAIN_ID, CONTRACTS.borrowerOperations,
		openingState.data?.blockHash, openingState.data?.readAt,
		collateralWei.toString(), borrowedWei.toString(), rateWei.toString()];
	const openingQuote = useQuery({
		queryKey: openingKey,
		enabled: stateReady,
		retry: false,
		queryFn: () => quoteOpeningFromState(publicClient, requireOpeningQuote(openingState), collateralWei, borrowedWei, rateWei),
	});
	let quoteReady = false;
	try { requireOpeningQuote(openingState); requireOpeningQuote(openingQuote); quoteReady = true; } catch { /* fail closed */ }
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

	const priceReady = stateReady;
  const chainReady = Boolean(chainState.data) && quoteReady;
  const feeReady = quoteReady;
	const spyPrice = openingState.data ? Number(formatUnits(openingState.data.price, 18)) : 0;
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
  const redemptionRisk = redemptionRiskFor(rate, marketAverageRate);
  const maxLtv = 1 / minimumRatio;
  const active = collateralWei > 0n && borrowedWei > 0n;
  // Named the way Liquity names it, from how much of the maximum LTV is used.
  const liquidationLevel = active && quoteReady ? liquidationRisk(ltv, maxLtv) : null;
  // Three loan sizes for this collateral, one per risk band, each rounded down
  // to a whole FUSD. Anything under the protocol minimum debt is left out.
  const minDebt = Number(formatUnits(MIN_DEBT, 18));
  const debtSuggestions = quoteReady && collateralUsd > 0 && maxBorrowWei > 0n
    ? DEBT_SUGGESTIONS
      .map((share) => Math.floor(Number(formatUnits(maxBorrowWei, 18)) * share))
      .filter((amount) => amount >= minDebt)
      .map((amount) => ({ amount, risk: liquidationRisk(amount / collateralUsd, maxLtv) }))
    : [];
  const pending = stage !== 'idle';

	function selectLoanToken(symbol: LoanToken) {
		if (pending) return;
		setLoanTokenIntro(false);
		if (symbol !== loanToken) captureEvent('loan_token_selected', { context: 'open_position', asset: symbol });
		setLoanToken(symbol);
	}

	// Collateral Max changes the quote key. Wait for that collateral's live
	// fee-inclusive capacity, then fill once; never follow subsequent price updates.
	useEffect(() => {
		if (!autoMaxLoan) return;
		if (pending || !wallet.connected || account !== autoMaxLoan.account
			|| collateralWei !== autoMaxLoan.collateral || debtStr.trim() !== ''
			|| openingQuote.isError || openingState.isError) {
			setAutoMaxLoan(null);
			return;
		}
		if (!quoteReady) return;
		setAutoMaxLoan(null);
		if (maxBorrowWei > 0n) setDebtStr(formatOpeningMax(maxBorrowWei));
	}, [autoMaxLoan, pending, wallet.connected, account, collateralWei, debtStr,
		openingQuote.isError, openingState.isError, quoteReady, maxBorrowWei]);

  const walletBalance = chainState.data ? Number(formatUnits(chainState.data.balance, 18)) : 0;
  const protocolError = quoteReady && quote ? validateOpeningAmount(collateralWei, borrowedWei, rateWei, quote.fee, quote.capacity) : null;
  const insufficientSpy = chainState.data
    ? chainState.data.balance < requiredSpyApproval(collateralWei)
    : false;
  const unsafe = quoteReady && quote ? borrowedWei + quote.fee > quote.capacity : false;

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
    setOpenedPosition(null);
    let failureStage: TransactionFailureStage = 'switching';
    let transactionHash: Hash | null = null;
    try {
      setStage('switching');
      await requireAuthorizedAccount(wallet.provider, account);
      await ensureRobinhoodTestnet(wallet.provider);
      await requireAuthorizedAccount(wallet.provider, account);
      failureStage = 'preparing';
			requireOpeningQuote(openingState);
      const reviewed = requireOpeningQuote(openingQuote);
      // Re-read before signing, and again after all signature/hint work. Never
      // silently alter the principal, even when the newly available Max changes.
      const refreshOpening = async () => {
        const fresh = await quoteOpening(publicClient, collateralWei, borrowedWei, rateWei);
				// Publish under the snapshot key: never put a new block's quote under an old block's key.
				queryClient.setQueryData(openingStateKey, fresh);
        return reviewOpeningRefresh(reviewed, fresh, collateralWei, borrowedWei, rateWei);
      };
      await refreshOpening();
      const requiredApproval = requiredSpyApproval(collateralWei);
      const directStatePromise = enableAccounts
        ? Promise.resolve(null)
        : publicClient.getBalance({ address: account });
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
        const updateMarkets = prepareMarketAction();
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
        let replacementInvalid = false;
        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          onReplaced: (replacement) => {
            if (replacement.reason !== 'repriced') replacementInvalid = true;
            transactionHash = replacement.transaction.hash;
            setTxHash(transactionHash);
          },
        });
        if (replacementInvalid) throw new Error('The transaction was cancelled or replaced.');
        if (receipt.status !== 'success') throw new Error('The account open-position transaction reverted.');
        pendingPositions.confirm(account, CONTRACTS.troveManager, receipt);
        setOpenedPosition(positionsFromReceipt(account, CONTRACTS.troveManager, receipt)[0] ?? null);
        updateMarkets(receipt, {
          deposited: Number(formatUnits(collateralWei, 18)),
          debtIssued: Number(formatUnits(borrowedWei, 18)),
        });

        await chainState.refetch();
        captureEvent('position_open_succeeded', {
          chain_id: ROBINHOOD_TESTNET_CHAIN_ID,
          wallet_kind: wallet.kind,
          redemption_risk: redemptionRisk,
        });
        setMinted(true);
        return;
      }

      if (directState === null) throw new Error('Direct wallet state was not loaded.');
      if (directState < LIQUIDATOR_COMPENSATION_WETH) {
        throw new Error(`Not enough funds. You need ${formatUnits(LIQUIDATOR_COMPENSATION_WETH, 18)} ETH plus network fees to fund the liquidator compensation.`);
      }
      const walletClient = createWalletClient({
        account,
        chain: robinhoodTestnet,
        transport: custom(wallet.provider),
      });

      setStage('preparing');

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

      const typedPermit = await prepareCollateralPermit(publicClient, account, collateralWei);
      await requireAuthorizedAccount(wallet.provider, account);
      failureStage = 'signing-permit';
      setStage('signing-permit');
      // Rejection is final: never fall back to approvals or another opening path.
      const signature = await walletClient.signTypedData(typedPermit);
      const permit = collateralPermitParams(collateralWei, typedPermit.message.deadline, signature);
      failureStage = 'preparing';
      setStage('preparing');
      await requireAuthorizedAccount(wallet.provider, account);

      const feeLimit = await refreshOpening();
      failureStage = 'opening';
      setStage('opening');
      const ownerIndex = randomOwnerIndex();
      const simulation = await publicClient.simulateContract({
        account,
        address: CONTRACTS.gasCompZapper,
        abi: [...gasCompZapperAbi, ...borrowerOperationsAbi],
        functionName: 'openTroveWithRawETHPermit',
        value: LIQUIDATOR_COMPENSATION_WETH,
        args: [
          permit,
          {
            owner: account, ownerIndex, collAmount: collateralWei, boldAmount: borrowedWei,
            upperHint, lowerHint, annualInterestRate: rateWei, batchManager: zeroAddress,
            maxUpfrontFee: feeLimit,
            // These are zapper-local permissions. BO always registers the zapper;
            // owner calls to BO still receive withdrawals directly (owner != manager).
            // A zero remove manager requires a zero receiver, not the owner address.
            addManager: zeroAddress, removeManager: zeroAddress, receiver: zeroAddress,
          },
        ],
      });
      const updateMarkets = prepareMarketAction();
      let replacementInvalid = false;
      const hash = await walletClient.writeContract(simulation.request);
      transactionHash = hash;
      setTxHash(hash);
      failureStage = 'confirming';
      setStage('confirming');
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        onReplaced: (replacement) => {
          if (replacement.reason !== 'repriced') replacementInvalid = true;
          transactionHash = replacement.transaction.hash;
          setTxHash(transactionHash);
        },
      });
      if (replacementInvalid) throw new Error('The transaction was cancelled or replaced.');
      if (receipt.status !== 'success') throw new Error('The open-trove transaction reverted.');
      pendingPositions.confirm(account, CONTRACTS.troveManager, receipt);
      setOpenedPosition(positionsFromReceipt(account, CONTRACTS.troveManager, receipt)[0] ?? null);
      updateMarkets(receipt, {
        deposited: Number(formatUnits(collateralWei, 18)),
        debtIssued: Number(formatUnits(borrowedWei, 18)),
      });

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
      : stage === 'preparing'
        ? 'Preparing position…'
        : stage === 'signing-permit'
          ? 'Sign SPY permit in wallet…'
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
				<LoanTokenToggle
					value={loanToken}
					intro={enableLoanTokenSpin && loanTokenIntro}
					disabled={pending}
					onChange={selectLoanToken}
					onIntroEnd={() => setLoanTokenIntro(false)}
				/>
        <span>with</span>
        <span className="swap__pair"><TokenIcon symbol="SPY" size={30} /><span className="swap__tok">SPY</span></span>
      </h1>

      <div className="swap__field">
        <span className="swap__label">Collateral</span>
        <div className="swap__row">
					<input autoFocus disabled={pending} className="swap__amount" inputMode="decimal" placeholder="0.00" value={spyStr}
            onChange={(event) => {
              markFormStarted('collateral');
							setAutoMaxLoan(null);
              setSpyStr(event.target.value);
            }} aria-label="SPY collateral" />
          <button
            type="button"
            className="swap__max"
            aria-label="Use maximum SPY collateral"
            disabled={pending || !wallet.connected || !chainState.data || chainState.isError || chainState.data.balance <= 0n}
            onClick={() => {
              if (pending || !wallet.connected || !chainState.data || chainState.isError || chainState.data.balance <= 0n) return;
              markFormStarted('collateral');
              captureEvent('max_amount_selected', { context: 'open_position', asset: 'SPY' });
              setSpyStr(formatUnits(chainState.data.balance, 18));
							setAutoMaxLoan(debtStr.trim() === ''
								? { account, collateral: chainState.data.balance }
								: null);
            }}
          >
            Max
          </button>
          <span className="swap__pill"><Token symbol="SPY" size={18} /></span>
        </div>
        <span className="swap__usd">
          ${money(collateralUsd)} · wallet {wallet.connected ? `${money(walletBalance, 4)} SPY` : 'not connected'}
        </span>
      </div>
      <div className="swap__meta">
        <span>
					Oracle price <b>{priceReady ? `$${money(spyPrice)}` : openingState.isError || openingState.data ? 'unavailable' : 'loading…'}</b>{' '}
          {priceReady && <><i className="swap__dot swap__dot--ok" /> onchain</>}
        </span>
        <span>Max LTV <b>{quoteReady ? pct(100 / minimumRatio, 1) : '−'}</b></span>
      </div>

      <div className="swap__field">
        <span className="swap__label">Loan</span>
        <div className="swap__row">
          <input disabled={pending} className="swap__amount" inputMode="decimal" placeholder="10.00" value={debtStr}
            onChange={(event) => {
              markFormStarted('borrow_amount');
							setAutoMaxLoan(null);
              setDebtStr(event.target.value.replaceAll(',', ''));
            }} aria-label={`${loanToken} to borrow`} />
          <button
            type="button"
            className="swap__max"
            disabled={pending || !quoteReady || maxBorrowWei <= 0n}
            onClick={() => {
              captureEvent('max_amount_selected', { context: 'open_position', asset: loanToken });
              try {
								requireOpeningQuote(openingState);
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
				onChange={selectLoanToken}
          />
        </div>
        <div className="swap__foot">
          <span className="swap__usd">
            ${money(borrow)} received{fee > 0 ? ` · ${money(totalDebt)} debt including ${money(fee)} upfront interest` : ''}
          </span>
          {debtSuggestions.length > 0 && (
            <span className="swap__suggest" role="group" aria-label="Suggested loan amounts">
              {debtSuggestions.map(({ amount, risk }) => (
                <button
                  key={risk}
                  type="button"
                  className="swap__chip"
                  disabled={pending}
                  title={`${RISK_LABEL[risk]} liquidation risk`}
                  aria-label={`Borrow ${money(amount, 0)} ${loanToken}, ${risk} liquidation risk`}
                  onClick={() => {
                    markFormStarted('borrow_amount');
                    captureEvent('loan_suggestion_selected', { context: 'open_position', risk });
                    setDebtStr(String(amount));
                  }}
                >
                  <i className={`swap__dot swap__dot--${risk}`} />
                  {chipAmount(amount)}
                </button>
              ))}
            </span>
          )}
        </div>
      </div>
      <div className="swap__meta">
        {liquidationLevel ? (
          <span className={`risk-tag risk-tag--${liquidationLevel}`}>
            <i className={`swap__dot swap__dot--${liquidationLevel}`} />
            {RISK_LABEL[liquidationLevel]} liquidation risk
          </span>
        ) : (
          <span className="risk-tag"><i className="swap__dot" /> Liquidation risk</span>
        )}
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
          <span className={`risk-tag risk-tag--${redemptionRisk}`}>
            <i className={`swap__dot swap__dot--${redemptionRisk}`} />
            {RISK_LABEL[redemptionRisk]} redemption risk
          </span>
        ) : (
          <span>Market average rate unavailable</span>
        )}
      </div>

      {protocolError && active && <p className="warn">{protocolError}</p>}
      {quoteReady && collateralWei > 0n && maxBorrowWei === 0n && (
        <p className="warn">No opening amount at cent precision meets the minimum debt and current collateral limits. Increase your collateral.</p>
      )}
      {insufficientSpy && <p className="warn">Your wallet does not have enough testnet SPY for the collateral.</p>}
      {chainState.isError && <p className="warn">Could not read the Robinhood testnet contracts. Try again before submitting.</p>}
			{(openingQuote.isError || openingState.isError) && <p className="warn">Live opening limits or the oracle are unavailable. Refresh before submitting.</p>}
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

      <details className="swap__note swap__note--first">
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
      <details className="swap__note">
        <summary>What happens when you open a position?</summary>
        <p>{enableAccounts
          ? 'Your account service opens the position with your SPY collateral and mints FUSD.'
          : 'Sign a permit for the exact SPY collateral, then confirm one transaction with 0.001 ETH for liquidator compensation, plus network fees. The zapper wraps that ETH, deposits your SPY, and mints FUSD. No separate approval or wrapping transactions are needed.'}</p>
        <p>Max includes the upfront fee and the live branch collateral requirement. It is a boundary, not a guarantee, because price and accrued debt can change before execution. If your amount no longer fits, you must review it before submitting.</p>
      </details>
    </div>
  );
}
