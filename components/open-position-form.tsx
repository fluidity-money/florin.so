'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import posthog from 'posthog-js';
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
import {
  describeTransactionError,
  type TransactionErrorDescription,
  type TransactionFailureStage,
} from '../lib/transaction-error';
import { useWallet } from './wallet/wallet';
import {
  borrowerOperationsAbi,
  CONTRACTS,
  erc20Abi,
  hintHelpersAbi,
  hintTrials,
  LIQUIDATOR_COMPENSATION_WETH,
  maxUpfrontFee,
  MIN_DEBT,
  priceFeedAbi,
  randomOwnerIndex,
  requiredSpyApproval,
  requiredWethWrap,
  ROBINHOOD_TESTNET_CHAIN_ID,
  sortedTrovesAbi,
  validateOpenTrove,
  wethAbi,
} from '../lib/borrow-contract';

const publicClient = createPublicClient({ chain: robinhoodTestnet, transport: http() });
const MIN_RATE = 0.005;
const MAX_RATE = 0.25;
const DEFAULT_RATE = 0.06;
const MCR = 1.1;
const MAX_LTV = 1 / MCR;

type TxStage = 'idle' | 'switching' | 'wrapping' | 'approving-weth' | 'approving' | 'opening' | 'confirming';

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

export function OpenPositionForm() {
  const wallet = useWallet();
  const account = wallet.address as Address | null;
  const [spyStr, setSpyStr] = useState('');
  const [debtStr, setDebtStr] = useState('');
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [stage, setStage] = useState<TxStage>('idle');
  const [error, setError] = useState<TransactionErrorDescription | null>(null);
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

  function reportError(cause: unknown, failureStage: TransactionFailureStage, transactionHash: Hash | null = null) {
    const description = describeTransactionError(cause, failureStage);
    setError(description);

    if (posthog.__loaded) {
      posthog.capture('open_trove_failed', {
        stage: description.stage,
        error_title: description.title,
        error_explanation: description.explanation,
        error_details: description.technicalDetails,
        error_code: description.code,
        chain_id: ROBINHOOD_TESTNET_CHAIN_ID,
        contract: CONTRACTS.borrowerOperations,
        transaction_hash: transactionHash,
      });
    }
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
    if (pending || protocolError || unsafe || insufficientSpy) return;

    setError(null);
    setTxHash(null);
    let failureStage: TransactionFailureStage = 'switching';
    let transactionHash: Hash | null = null;
    try {
      setStage('switching');
      await ensureRobinhoodTestnet(wallet.provider);
      const walletClient = createWalletClient({
        account,
        chain: robinhoodTestnet,
        transport: custom(wallet.provider),
      });

      failureStage = 'preparing';
      const requiredApproval = requiredSpyApproval(collateralWei);
      const [balance, allowance, wethBalance, wethAllowance, nativeBalance, predictedFee, troveCount] = await Promise.all([
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
          maxUpfrontFee(predictedFee),
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
        <p>Your wallet wraps up to 0.001 ETH into WETH and approves it for liquidator compensation. It separately approves the exact SPY collateral, then opens the position and mints FUSD.</p>
        <p>Your interest rate also determines your place in the redemption queue: lower-rate positions are redeemed first.</p>
      </details>

      {protocolError && active && <p className="warn">{protocolError}</p>}
      {unsafe && <p className="warn">This position is below the protocol&apos;s 110% minimum collateral ratio.</p>}
      {insufficientSpy && <p className="warn">Your wallet does not have enough testnet SPY for the collateral.</p>}
      {chainState.isError && <p className="warn">Could not read the Robinhood testnet contracts. Try again before submitting.</p>}
      {upfrontFee.isError && <p className="warn">Could not quote the onchain upfront fee. Try again before submitting.</p>}
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
        disabled={wallet.connected && (!active || Boolean(protocolError) || unsafe || insufficientSpy || pending || !chainReady || !feeReady || chainState.isError || upfrontFee.isError)}
        onClick={() => void openTrove()}
      >
        {buttonLabel}
      </Button>

      <RisksDialog />
    </div>
  );
}
