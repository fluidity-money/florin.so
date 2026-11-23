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
import { MarketClosedNotice } from './market-closed-notice';
import { useMarketClosed } from '../lib/use-market-hours';
import Link from 'next/link';
import { getFormOpeningHints } from '../lib/form-opening-hints';
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
	LIQUIDATOR_COMPENSATION_WETH,
	randomOwnerIndex,
	requiredSpyApproval,
	ROBINHOOD_TESTNET_CHAIN_ID,
	sortedTrovesAbi,
	MIN_DEBT,
} from '../lib/borrow-contract';

import { OPENING_MAX_AGE_MS, readOpeningState, quoteOpeningFromState, quoteOpening, requireOpeningQuote, reviewOpeningRefresh, validateOpeningAmount, formatOpeningMax } from '../lib/opening-capacity';
import { USDG_ZAPPER, usdgZapperAbi, readUsdgOpeningState, quoteUsdgOpening, parseUsdgAmount, usdgPrincipal, validateUsdgSwap, type BorrowState } from '../lib/usdg-borrow';

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
	const marketClosed = useMarketClosed();
	const enableAccounts = useFeature('enable-accounts');
	const enableLoanTokenSpin = useFeature('enable-loan-token-spin', false);
	const enableZeroPercentCaret = useFeature('enable-0-percent-caret', false);
	const { createAccountFlorinOpenPosition } = useAccount();
	const markets = useFlorinMarkets(initialMarkets);
	const prepareMarketAction = useMarketAction();
	const { borrow: spyMarketDetails } = spyMarket(markets);
	const marketAverageRate = parseDisplayPercent(spyMarketDetails?.avgRatePa);
	const account = wallet.address as Address | null;
	const [spyStr, setSpyStr] = useState('');
	const [debtStr, setDebtStr] = useState('');
	const [rate, setRate] = useState(DEFAULT_RATE);

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

	const rateWei = usdgSelected ? parseUnits(rate.toFixed(4), 18) : BigInt(Math.round(rate * 1e18));

	const queryClient = useQueryClient();
	const openingStateKey = ['opening-state', ROBINHOOD_TESTNET_CHAIN_ID, CONTRACTS.borrowerOperations, CONTRACTS.spyPriceFeed, loanToken, usdgSelected ? USDG_ZAPPER : CONTRACTS.gasCompZapper];
	const openingState = useQuery<BorrowState>({
		queryKey: openingStateKey,
		queryFn: () => usdgSelected ? readUsdgOpeningState(publicClient) : readOpeningState(publicClient),
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
	const { stateReady, swap, outputWei, borrowedWei, amountError, swapError } = readLoanAmounts();

	function readLoanAmounts() {
		let stateReady = false;
		try { requireOpeningQuote(openingState); stateReady = true; } catch { /* fail closed */ }
		const swap = openingState.data?.swap;
		let outputWei = 0n;
		let borrowedWei = usdgSelected ? 0n : parseToken(debtStr);
		let amountError: string | null = null;
		let swapError: string | null = null;
		if (usdgSelected && swap) {
			try {
				outputWei = parseUsdgAmount(debtStr, swap.decimals);
				borrowedWei = usdgPrincipal(outputWei, swap);
			} catch (cause) { amountError = (cause as Error).message; }
			if (!amountError) {
				try { validateUsdgSwap(borrowedWei, outputWei, swap); }
				catch (cause) { swapError = (cause as Error).message; }
			}
		}
		return { stateReady, swap, outputWei, borrowedWei, amountError, swapError };
	}

	const openingKey = ['opening-capacity', ROBINHOOD_TESTNET_CHAIN_ID, CONTRACTS.borrowerOperations,
		openingState.data?.blockHash, openingState.data?.readAt,
		loanToken, USDG_ZAPPER, collateralWei.toString(), borrowedWei.toString(), outputWei.toString(), rateWei.toString()];
	const openingQuote = useQuery({
		queryKey: openingKey,
		enabled: stateReady && !amountError && rateWei > 0n,
		retry: false,
		queryFn: async () => usdgSelected
			? quoteUsdgOpening(publicClient, requireOpeningQuote(openingState), collateralWei, outputWei, rateWei)
			: { ...await quoteOpeningFromState(publicClient, requireOpeningQuote(openingState), collateralWei, borrowedWei, rateWei), maxUsdg: 0n },
	});
	let quoteReady = false;
	try { requireOpeningQuote(openingState); requireOpeningQuote(openingQuote); quoteReady = !amountError && rateWei > 0n; } catch { /* fail closed */ }
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

	const { priceReady, chainReady, feeReady, spyPrice, spy, borrow, fee, collateralUsd, collateralRatio, ltv, maxBorrowWei, formatLoanMax, minimumRatio, liquidationPrice, annualInterest, redemptionRisk, active, liquidationLevel, debtSuggestions, pending } = calculateBorrowPreview();

	function calculateBorrowPreview() {
		const priceReady = stateReady;
		const chainReady = Boolean(chainState.data) && quoteReady;
		const feeReady = quoteReady;
		const spyPrice = openingState.data ? Number(formatUnits(openingState.data.price, 18)) : 0;
		const spy = Math.max(0, xnum(spyStr));
		const borrow = Math.max(0, xnum(debtStr));
		const fee = Number(formatUnits(quote?.fee ?? 0n, 18));
		const totalDebt = Number(formatUnits(borrowedWei, 18)) + fee;
		const collateralUsd = spy * spyPrice;
		const collateralRatio = totalDebt > 0 ? collateralUsd / totalDebt : 0;
		const ltv = collateralUsd > 0 ? totalDebt / collateralUsd : 0;
		const maxBorrowWei = (usdgSelected ? quote?.maxUsdg : quote?.maxPrincipal) ?? 0n;
		const formatLoanMax = (amount: bigint) => usdgSelected && swap ? formatUnits(amount, swap.decimals) : formatOpeningMax(amount);
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
		const debtSuggestions = !usdgSelected && quoteReady && collateralUsd > 0 && maxBorrowWei > 0n
			? DEBT_SUGGESTIONS
				.map((share) => Math.floor(Number(formatUnits(maxBorrowWei, 18)) * share))
				.filter((amount) => amount >= minDebt)
				.map((amount) => ({ amount, risk: liquidationRisk(amount / collateralUsd, maxLtv) }))
			: [];
		const pending = stage !== 'idle';
		return { priceReady, chainReady, feeReady, spyPrice, spy, borrow, fee, totalDebt, collateralUsd, collateralRatio, ltv, maxBorrowWei, formatLoanMax, minimumRatio, liquidationPrice, annualInterest, redemptionRisk, active, liquidationLevel, debtSuggestions, pending };
	}

	function selectLoanToken(symbol: LoanToken) {
		if (pending) return;
		setLoanTokenIntro(false);
		if (symbol !== loanToken) captureEvent('loan_token_selected', { context: 'open_position', asset: symbol });
		setLoanToken(symbol);
	}

	const { walletBalance, protocolError, insufficientSpy, unsafe } = validateBorrowForm();

	function validateBorrowForm() {
		const walletBalance = chainState.data ? Number(formatUnits(chainState.data.balance, 18)) : 0;
		const protocolError = amountError ?? swapError ?? (quoteReady && quote ? validateOpeningAmount(collateralWei, borrowedWei, rateWei, quote.fee, quote.capacity) : null);
		const insufficientSpy = chainState.data
			? chainState.data.balance < requiredSpyApproval(collateralWei)
			: false;
		const unsafe = quoteReady && quote ? borrowedWei + quote.fee > quote.capacity : false;
		return { walletBalance, protocolError, insufficientSpy, unsafe };
	}

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
		if (rate === 0) return;
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
		const owner = account;
		const provider = wallet.provider;
		let failureStage: TransactionFailureStage = 'switching';
		let transactionHash: Hash | null = null;

		async function confirmOpening(
			hash: Hash,
			revertedMessage: string,
			updateMarkets: ReturnType<typeof prepareMarketAction>,
		) {
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
			if (receipt.status !== 'success') throw new Error(revertedMessage);
			pendingPositions.confirm(owner, CONTRACTS.troveManager, receipt);
			setOpenedPosition(positionsFromReceipt(owner, CONTRACTS.troveManager, receipt)[0] ?? null);
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
		}
		try {
			setStage('switching');
			await requireAuthorizedAccount(provider, owner);
			await ensureRobinhoodTestnet(provider);
			await requireAuthorizedAccount(provider, owner);
			failureStage = 'preparing';
			requireOpeningQuote(openingState);
			const reviewed = requireOpeningQuote(openingQuote);
			// Re-read before signing, and again after all signature/hint work. Never
			// silently alter the principal, even when the newly available Max changes.
			const refreshOpening = async () => {
				let fresh: Awaited<ReturnType<typeof quoteOpening>> & Pick<BorrowState, 'swap'>;
				if (usdgSelected) {
					const snapshot = await readUsdgOpeningState(publicClient);
					queryClient.setQueryData(openingStateKey, snapshot);
					if (!snapshot.swap || !swap || snapshot.swap.decimals !== swap.decimals) throw new Error('USDG configuration changed. Review before submitting.');
					// Keep the reviewed principal, even when a refreshed price is favorable.
					validateUsdgSwap(borrowedWei, outputWei, snapshot.swap);
					fresh = { ...await quoteOpeningFromState(publicClient, snapshot, collateralWei, borrowedWei, rateWei, false), swap: snapshot.swap };
				} else {
					fresh = await quoteOpening(publicClient, collateralWei, borrowedWei, rateWei);
				}
				// Publish under the snapshot key: never put a new block's quote under an old block's key.
				queryClient.setQueryData(openingStateKey, fresh);
				return reviewOpeningRefresh(reviewed, fresh, collateralWei, borrowedWei, rateWei);
			};
			await refreshOpening();
			const requiredApproval = requiredSpyApproval(collateralWei);
			const directStatePromise = enableAccounts && !usdgSelected
				? Promise.resolve(null)
				: publicClient.getBalance({ address: owner });
			const [balance, troveCount, directState] = await Promise.all([
				publicClient.readContract({
					address: CONTRACTS.spyToken,
					abi: erc20Abi,
					functionName: 'balanceOf',
					args: [owner],
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

			if (enableAccounts && !usdgSelected) {
				await openAccountPosition();
				return;
			}

			async function openAccountPosition() {
				const { upperHint, lowerHint } = await getFormOpeningHints(publicClient, rateWei, troveCount);

				const feeLimit = await refreshOpening();
				failureStage = 'opening';
				setStage('opening');
				const ownerIndex = randomOwnerIndex();
				const updateMarkets = prepareMarketAction();
				const result = await createAccountFlorinOpenPosition({
					openPosition: {
						owner: owner,
						asset: 'SPY',
						collateralAmt: collateralWei.toString(),
						boldAmt: borrowedWei.toString(),
						annualInterestRate: rateWei.toString(),
						ownerIndex: ownerIndex.toString(),
						maxUpfrontFee: feeLimit.toString(),
						lowerHint: lowerHint.toString(),
						upperHint: upperHint.toString(),
						receiver: owner,
					},
					gasToken: 'SPY',
					gasTokenAmt: '0',
					dryrun: false,
				});
				if (!/^0x[0-9a-fA-F]{64}$/.test(result.hash)) {
					throw new Error('The account service returned an invalid transaction hash.');
				}
				const hash = result.hash as Hash;
				await confirmOpening(hash, 'The account open-position transaction reverted.', updateMarkets);
			}

			await openDirectPosition();

			async function openDirectPosition() {
				if (directState === null) throw new Error('Direct wallet state was not loaded.');
				if (directState < LIQUIDATOR_COMPENSATION_WETH) {
					throw new Error(`Not enough funds. You need ${formatUnits(LIQUIDATOR_COMPENSATION_WETH, 18)} ETH plus network fees to fund the liquidator compensation.`);
				}
				const walletClient = createWalletClient({
					account: owner,
					chain: robinhoodTestnet,
					transport: custom(provider),
				});

				setStage('preparing');

				const { upperHint, lowerHint } = await getFormOpeningHints(publicClient, rateWei, troveCount);

				const typedPermit = await prepareCollateralPermit(publicClient, owner, collateralWei, usdgSelected ? USDG_ZAPPER : CONTRACTS.gasCompZapper);
				if (usdgSelected) await refreshOpening();
				await requireAuthorizedAccount(provider, owner);
				failureStage = 'signing-permit';
				setStage('signing-permit');
				// Rejection is final: never fall back to approvals or another opening path.
				const signature = await walletClient.signTypedData(typedPermit);
				const permit = collateralPermitParams(collateralWei, typedPermit.message.deadline, signature);
				failureStage = 'preparing';
				setStage('preparing');
				await requireAuthorizedAccount(provider, owner);

				const feeLimit = await refreshOpening();
				failureStage = 'opening';
				setStage('opening');
				const ownerIndex = randomOwnerIndex();
				const swapParams = {
					owner: owner, ownerIndex, collAmount: collateralWei, boldAmount: borrowedWei, usdgAmount: outputWei,
					upperHint, lowerHint, annualInterestRate: rateWei, batchManager: zeroAddress,
					maxUpfrontFee: feeLimit, addManager: zeroAddress, removeManager: zeroAddress, receiver: zeroAddress,
				};
				const simulation = usdgSelected ? await publicClient.simulateContract({
					account: owner, address: USDG_ZAPPER, abi: [...usdgZapperAbi, ...borrowerOperationsAbi],
					functionName: 'openTroveWithRawETHPermitSwap', value: LIQUIDATOR_COMPENSATION_WETH,
					args: [permit, swapParams],
				}) : await publicClient.simulateContract({
					account: owner,
					address: CONTRACTS.gasCompZapper,
					abi: [...gasCompZapperAbi, ...borrowerOperationsAbi],
					functionName: 'openTroveWithRawETHPermit',
					value: LIQUIDATOR_COMPENSATION_WETH,
					args: [
						permit,
						{
							owner: owner, ownerIndex, collAmount: collateralWei, boldAmount: borrowedWei,
							upperHint, lowerHint, annualInterestRate: rateWei, batchManager: zeroAddress,
							maxUpfrontFee: feeLimit,
							// These are zapper-local permissions. BO always registers the zapper;
							// owner calls to BO still receive withdrawals directly (owner != manager).
							// A zero remove manager requires a zero receiver, not the owner address.
							addManager: zeroAddress, removeManager: zeroAddress, receiver: zeroAddress,
						},
					],
				});
				// About 2% of opens on testnet ran out of gas at the wallet's own
				// estimate: the zapper's gas use moves with the hints and pool state
				// between estimate and inclusion. Unused gas is refunded, so a 30%
				// margin costs the user nothing.
				const request = simulation.request;
				const gasEstimate = request.functionName === 'openTroveWithRawETHPermitSwap'
					? await publicClient.estimateContractGas(request)
					: await publicClient.estimateContractGas(request);
				if (usdgSelected) await refreshOpening();
				const updateMarkets = prepareMarketAction();
				await requireAuthorizedAccount(provider, owner);
				const gas = (gasEstimate * 13n) / 10n;
				const hash = request.functionName === 'openTroveWithRawETHPermitSwap'
					? await walletClient.writeContract({ ...request, gas })
					: await walletClient.writeContract({ ...request, gas });
				await confirmOpening(hash, 'The open-trove transaction reverted.', updateMarkets);
			}
		} catch (cause) {
			reportError(cause, failureStage, transactionHash);
		} finally {
			setStage('idle');
		}
	}

	function renderBorrowCollateral() {
		return (<>
			<div className="swap__field">
				<span className="swap__label">Collateral</span>
				<div className="swap__row">
					<input autoFocus disabled={pending} className="swap__amount" inputMode="decimal" placeholder="0.00" value={spyStr}
						onChange={(event) => {
							markFormStarted('collateral');
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
							// Collateral only. The loan stays the user's choice, typed or
							// picked from the risk-coloured suggestions.
							setSpyStr(formatUnits(chainState.data.balance, 18));
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
		</>);
	}

	function renderBorrowLoan() {
		return (<>
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
								requireOpeningQuote(openingState);
								const current = requireOpeningQuote(openingQuote);
								if (pending || !quoteReady) return;
								setDebtStr(formatLoanMax(usdgSelected ? current.maxUsdg : current.maxPrincipal));
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
					{/* One short line, so the suggestions fit beside it and the box keeps its height. */}
					<div className="swap__usd swap__loan-summary">
						{usdgSelected ? (
							<>
								<span>{quoteReady ? `At least ${formatUnits(outputWei, swap!.decimals)} USDG received` : 'USDG quote unavailable'}</span>
								<span>{quoteReady ? `${formatUnits(borrowedWei, 18)} FUSD principal` : 'Debt and repayments are in FUSD'}</span>
							</>
						) : (
							<span className="swap__loan-usd" title={`$${money(borrow)}`}>${money(borrow)}</span>
						)}
					</div>
					<span className="swap__suggest" role={debtSuggestions.length > 0 ? 'group' : undefined} aria-label={debtSuggestions.length > 0 ? 'Suggested loan amounts' : undefined}>
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
				</div>
			</div>
		</>);
	}

	function renderBorrowRisk() {
		return (<>
			<div className="swap__meta swap__meta--compact">
				<span>+ <b>{quoteReady ? money(fee) : '−'}</b> FUSD upfront interest</span>
				<span>Current max borrow <b>{quoteReady && spy > 0 ? `${formatLoanMax(maxBorrowWei)} ${loanToken}` : '−'}</b></span>
			</div>
			<div className="swap__meta swap__meta--compact">
				{liquidationLevel ? (
					<span className={`risk-tag risk-tag--${liquidationLevel}`}>
						<i className={`swap__dot swap__dot--${liquidationLevel}`} />
						{RISK_LABEL[liquidationLevel]} liquidation risk
					</span>
				) : (
					<span className="risk-tag"><i className="swap__dot" /> Liquidation risk</span>
				)}
				<span>Liquidation price <b>{active && (!usdgSelected || quoteReady) ? `$${money(liquidationPrice)}` : '−'}</b></span>
			</div>
			<div className="swap__meta swap__meta--right">
				<span>LTV <b>{active && (!usdgSelected || quoteReady) ? pct(ltv * 100, 1) : '−'}</b>{active && (!usdgSelected || quoteReady) && <em> ({pct(collateralRatio * 100, 0)} CR)</em>}</span>
			</div>
		</>);
	}

	function renderBorrowInterest() {
		return (<>
			<div className="swap__field swap__field--rate">
				<div className="swap__row">
					<span className="swap__label">
						Set interest rate
						<em className="swap__market-average">{marketAverageRate !== null ? `(avg. ${pct(marketAverageRate * 100, 2)})` : '(avg. −)'}</em>
					</span>
				</div>
				<div className="swap__row swap__row--opening-rate">
					<span className="swap__amount swap__amount--rate">{pct(rate * 100, 2)}</span>
					<div className="swap__rate-control">
						<input disabled={pending} className="slider swap__slider" type="range" min={0} max={MAX_RATE} step={0.0025}
							value={rate} onChange={(event) => {
								markFormStarted('interest_rate');
								const nextRate = parseFloat(event.target.value);
								// Skip unsupported positive rates below the protocol minimum in either direction.
								setRate(nextRate > 0 && nextRate < MIN_RATE ? (rate === 0 ? MIN_RATE : 0) : nextRate);
							}} aria-label="Interest rate" aria-describedby={enableZeroPercentCaret ? 'zero-interest-rate-note' : undefined} />
						<span className="swap__zero-rate" id="zero-interest-rate-note" aria-hidden={!enableZeroPercentCaret} style={{ visibility: enableZeroPercentCaret ? 'visible' : 'hidden' }}>
							<span className="swap__zero-rate-caret" aria-hidden="true" />
							0% interest rate positions
						</span>
					</div>
				</div>
				<span className="swap__usd">{usdgSelected && !quoteReady ? '−' : money(annualInterest)} FUSD / year</span>
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
		</>);
	}

	function renderBorrowWarnings() {
		return (<>
			{protocolError && active && rate !== 0 && <p className="warn">{protocolError}</p>}
			{usdgSelected && amountError && !active && <p className="warn">{amountError}</p>}
			{usdgSelected && (openingState.error || openingQuote.error) && <p className="warn" role="alert">{(openingState.error || openingQuote.error)?.message}</p>}
			{quoteReady && collateralWei > 0n && maxBorrowWei === 0n && (
				<p className="warn">{usdgSelected ? 'No USDG output meets the minimum FUSD debt, collateral limits and available exchange liquidity.' : 'No opening amount at cent precision meets the minimum debt and current collateral limits. Increase your collateral.'}</p>
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
		</>);
	}

	function renderBorrowSubmit() {
		const stageLabels: Record<TxStage, string> = { idle: usdgSelected ? 'Borrow USDG →' : 'Mint FUSD →', switching: 'Switching network…', preparing: 'Preparing position…', 'signing-permit': 'Sign SPY permit in wallet…', opening: 'Confirm position in wallet…', confirming: 'Waiting for confirmation…' };
		const buttonLabel = wallet.connected ? stageLabels[stage] : 'Connect wallet to continue';
		const submitLabel = rate === 0 ? '0% interest rate positions — coming soon' : buttonLabel;
		return (<>
			{marketClosed && <MarketClosedNotice paused="Opening positions is" />}
			<Button
				variant="primary"
				disabled={rate === 0 || (wallet.connected && (marketClosed || !active || Boolean(protocolError) || unsafe || insufficientSpy || pending || !chainReady || !feeReady || chainState.isError || openingQuote.isError))}
				onClick={() => {
					void openTrove();
				}}
			>
				{submitLabel}
			</Button>
		</>);
	}

	if (minted && txHash) {
		return (
			<div className="swap">
				<div className="swap__done">
					<span className="swap__done-mark" aria-hidden="true">✓</span>
					<h2>{usdgSelected ? 'USDG borrowed' : 'FUSD minted'}</h2>
					<p>{usdgSelected ? `At least ${debtStr} USDG was received. Your debt and repayments are in FUSD.` : `${money(borrow, 2)} FUSD was minted against ${money(spy, 4)} SPY.`}</p>
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

	return (
		<div className="swap swap--borrow">
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

			{renderBorrowCollateral()}
			{renderBorrowLoan()}
			{renderBorrowRisk()}
			{renderBorrowInterest()}
			{renderBorrowWarnings()}
			{renderBorrowSubmit()}
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
				{usdgSelected && <p>USDG uses the direct wallet zapper, never the account service. Sign a SPY permit and supply 0.001 ETH plus network fees. The position borrows FUSD and swaps it for at least your requested USDG. Debt, interest, liquidation risk and repayments remain in FUSD. Favorable swap proceeds are forwarded by the replacement zapper; USDG repayment is not supported.</p>}
				<p>{enableAccounts && !usdgSelected
					? 'Your account service opens the position with your SPY collateral and mints FUSD.'
					: 'Sign a permit for the exact SPY collateral, then confirm one transaction with 0.001 ETH for liquidator compensation, plus network fees. The zapper wraps that ETH, deposits your SPY, and mints FUSD. No separate approval or wrapping transactions are needed.'}</p>
				<p>Max includes the upfront fee and the live branch collateral requirement. It is a boundary, not a guarantee, because price and accrued debt can change before execution. If your amount no longer fits, you must review it before submitting.</p>
			</details>
		</div>
	);
}
