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
import { RisksDialog } from './risks-dialog';
import { Token, TokenIcon } from './token-icon';
import { useWallet } from './wallet/wallet';
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
  addMultiplySlippage,
  CONTRACTS,
  exchangeHelpersAbi,
  leverageZapperAbi,
  multiplyAmounts,
} from '../lib/multiply-contract';

const publicClient = createPublicClient({ chain: robinhoodTestnet, transport: http() });
const MIN_MULTIPLIER_TENTHS = 11;
const MAX_MULTIPLIER_TENTHS = 50;

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
  const quoterAddress = CONTRACTS.exchangeHelpers;
  const zapperConfigured = Boolean(
    zapperAddress
    && quoterAddress
    && isAddress(zapperAddress)
    && isAddress(quoterAddress)
    && zapperAddress !== zeroAddress
    && quoterAddress !== zeroAddress,
  );
  const [depositStr, setDepositStr] = useState('');
  const [multiplierTenths, setMultiplierTenths] = useState(20);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [complete, setComplete] = useState(false);

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

  const amounts = multiplyAmounts(depositWei, multiplierTenths);

  const swapQuote = useQuery({
    queryKey: ['multiply-swap-quote', quoterAddress, amounts.flashLoanAmount.toString()],
    enabled: Boolean(zapperConfigured && quoterAddress && amounts.flashLoanAmount > 0n),
    retry: false,
    queryFn: async () => {
      if (!quoterAddress) throw new Error('Multiply quoter is not configured.');
      const simulation = await publicClient.simulateContract({
        address: quoterAddress,
        abi: exchangeHelpersAbi,
        functionName: 'quoteExactOutput',
        args: [amounts.flashLoanAmount, false, BORROW_CONTRACTS.spyToken],
      });
      if (simulation.result <= 0n) throw new Error('The exchange returned an invalid quote.');
      return addMultiplySlippage(simulation.result);
    },
  });
  const boldAmount = swapQuote.data ?? 0n;

  const chainState = useQuery({
    queryKey: ['multiply-state', account, zapperAddress],
    enabled: Boolean(account && zapperConfigured),
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!account || !zapperAddress || !quoterAddress) throw new Error('Multiply contracts are not configured.');
      const [balance, allowance, nativeBalance, zapperCode, quoterCode, exchange, collToken, boldToken] = await Promise.all([
        publicClient.readContract({
          address: BORROW_CONTRACTS.spyToken,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account],
        }),
        publicClient.readContract({
          address: BORROW_CONTRACTS.spyToken,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [account, zapperAddress],
        }),
        publicClient.getBalance({ address: account }),
        publicClient.getCode({ address: zapperAddress }),
        publicClient.getCode({ address: quoterAddress }),
        publicClient.readContract({
          address: zapperAddress,
          abi: leverageZapperAbi,
          functionName: 'exchange',
        }),
        publicClient.readContract({
          address: zapperAddress,
          abi: leverageZapperAbi,
          functionName: 'collToken',
        }),
        publicClient.readContract({
          address: zapperAddress,
          abi: leverageZapperAbi,
          functionName: 'boldToken',
        }),
      ]);
      if (
        !zapperCode || zapperCode === '0x'
        || !quoterCode || quoterCode === '0x'
        || exchange === zeroAddress
        || collToken.toLowerCase() !== BORROW_CONTRACTS.spyToken.toLowerCase()
        || boldToken.toLowerCase() !== BORROW_CONTRACTS.boldToken.toLowerCase()
      ) {
        throw new Error('Multiply deployment contracts could not be verified on Robinhood testnet.');
      }
      return { balance, allowance, nativeBalance };
    },
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
  const multiplier = multiplierTenths / 10;
  const spyPrice = oraclePrice.data ? Number(formatUnits(oraclePrice.data, 18)) : 0;
  const exposure = Number(formatUnits(amounts.totalCollateral, 18));
  const principalDebt = Number(formatUnits(boldAmount, 18));
  const fee = Number(formatUnits(upfrontFee.data ?? 0n, 18));
  const totalDebt = principalDebt + fee;
  const exposureUsd = exposure * spyPrice;
  const ltv = exposureUsd > 0 ? totalDebt / exposureUsd : 0;
  const collateralRatio = totalDebt > 0 ? exposureUsd / totalDebt : 0;
  const liquidationPrice = exposure > 0 ? MIN_COLLATERAL_RATIO * totalDebt / exposure : 0;
  const walletBalance = chainState.data ? Number(formatUnits(chainState.data.balance, 18)) : 0;
  const insufficientSpy = Boolean(chainState.data && chainState.data.balance < depositWei);
  const insufficientEth = Boolean(chainState.data && chainState.data.nativeBalance < LIQUIDATOR_COMPENSATION_WETH);
  const unsafe = totalDebt > 0 && collateralRatio < MIN_COLLATERAL_RATIO;
  const belowMinimumDebt = boldAmount > 0n && boldAmount < MIN_DEBT;
  const pending = stage !== 'idle';
  const active = depositWei > 0n && boldAmount > 0n;

  async function openMultiplyPosition() {
    if (!wallet.connected || !account || !wallet.provider) {
      try {
        await wallet.connect();
      } catch (cause) {
        setError(errorMessage(cause));
      }
      return;
    }
    if (!zapperAddress || !quoterAddress || !zapperConfigured) {
      setError('Multiply is not configured for this deployment.');
      return;
    }
    if (!active || pending || unsafe || belowMinimumDebt || insufficientSpy || insufficientEth) return;

    setError(null);
    setTxHash(null);
    try {
      setStage('switching');
      await ensureRobinhoodTestnet(wallet.provider);

      const quoteSimulation = await publicClient.simulateContract({
        address: quoterAddress,
        abi: exchangeHelpersAbi,
        functionName: 'quoteExactOutput',
        args: [amounts.flashLoanAmount, false, BORROW_CONTRACTS.spyToken],
      });
      const submittedBoldAmount = addMultiplySlippage(quoteSimulation.result);
      if (submittedBoldAmount <= 0n) throw new Error('The exchange returned an invalid quote.');

      const [balance, allowance, nativeBalance, predictedFee, troveCount, zapperCode, quoterCode, exchange, collToken, boldToken] = await Promise.all([
        publicClient.readContract({
          address: BORROW_CONTRACTS.spyToken,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account],
        }),
        publicClient.readContract({
          address: BORROW_CONTRACTS.spyToken,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [account, zapperAddress],
        }),
        publicClient.getBalance({ address: account }),
        publicClient.readContract({
          address: BORROW_CONTRACTS.hintHelpers,
          abi: hintHelpersAbi,
          functionName: 'predictOpenTroveUpfrontFee',
          args: [0n, submittedBoldAmount, rateWei],
        }),
        publicClient.readContract({
          address: BORROW_CONTRACTS.sortedTroves,
          abi: sortedTrovesAbi,
          functionName: 'size',
        }),
        publicClient.getCode({ address: zapperAddress }),
        publicClient.getCode({ address: quoterAddress }),
        publicClient.readContract({
          address: zapperAddress,
          abi: leverageZapperAbi,
          functionName: 'exchange',
        }),
        publicClient.readContract({
          address: zapperAddress,
          abi: leverageZapperAbi,
          functionName: 'collToken',
        }),
        publicClient.readContract({
          address: zapperAddress,
          abi: leverageZapperAbi,
          functionName: 'boldToken',
        }),
      ]);

      if (
        !zapperCode || zapperCode === '0x'
        || !quoterCode || quoterCode === '0x'
        || exchange === zeroAddress
        || collToken.toLowerCase() !== BORROW_CONTRACTS.spyToken.toLowerCase()
        || boldToken.toLowerCase() !== BORROW_CONTRACTS.boldToken.toLowerCase()
      ) {
        throw new Error('Multiply deployment contracts could not be verified on Robinhood testnet.');
      }
      if (submittedBoldAmount < MIN_DEBT) throw new Error('The loop must borrow at least 10 FUSD.');
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
        maxUpfrontFee: maxUpfrontFee(predictedFee),
        addManager: zeroAddress,
        removeManager: zeroAddress,
        receiver: zeroAddress,
      } as const;

      setStage('opening');
      const simulation = await publicClient.simulateContract({
        account,
        address: zapperAddress,
        abi: leverageZapperAbi,
        functionName: 'openLeveragedTroveWithRawETH',
        args: [params],
        value: LIQUIDATOR_COMPENSATION_WETH,
      });
      const hash = await walletClient.writeContract(simulation.request);
      setTxHash(hash);
      setStage('confirming');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('The multiply transaction reverted.');
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
          <a className="btn btn--primary" href={`${robinhoodTestnet.blockExplorers.default.url}/tx/${txHash}`} target="_blank" rel="noreferrer">
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

      <div className="swap__field swap__field--rate">
        <div className="swap__row">
          <span className="swap__label">Multiplier</span>
          <span className="swap__amount swap__amount--rate">{multiplier.toFixed(1)}×</span>
        </div>
        <input className="slider swap__slider" type="range" min={MIN_MULTIPLIER_TENTHS} max={MAX_MULTIPLIER_TENTHS} step={1}
          value={multiplierTenths} onChange={(event) => setMultiplierTenths(Number(event.target.value))} aria-label="Multiplier" />
        <span className="swap__usd">Total SPY exposure: {active ? `${money(exposure, 4)} SPY ($${money(exposureUsd)})` : '−'}</span>
      </div>
      <div className="swap__meta">
        <span><i className={`swap__dot swap__dot--${unsafe ? 'liquidation' : ltv > 0.75 && active ? 'warning' : 'healthy'}`} /> Liquidation risk</span>
        <span>LTV <b>{active ? pct(ltv * 100, 1) : '−'}</b></span>
      </div>
      <div className="swap__meta">
        <span>FUSD debt <b>{active ? money(totalDebt, 2) : '−'}</b></span>
        <span>Liquidation price <b>{active ? `$${money(liquidationPrice)}` : '−'}</b></span>
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
        <p>The leverage contract flash-borrows SPY, opens one collateralized position, mints FUSD and swaps that FUSD back to SPY to repay the flash loan.</p>
        <p>Higher multipliers increase both equity exposure and liquidation risk. The quote includes 0.5% swap protection; unused FUSD or SPY is returned by the contract.</p>
      </details>

      {!zapperConfigured && <p className="warn">Multiply needs the leverage zapper and quote helper configured for this deployment.</p>}
      {unsafe && <p className="warn">This position is below the protocol&apos;s 110% minimum collateral ratio.</p>}
      {belowMinimumDebt && <p className="warn">The loop must borrow at least 10 FUSD.</p>}
      {insufficientSpy && <p className="warn">Your wallet does not have enough SPY for this deposit.</p>}
      {insufficientEth && <p className="warn">You need 0.001 ETH plus network fees for liquidator compensation.</p>}
      {oraclePrice.isError && <p className="warn">The SPY oracle is unavailable. Multiply is disabled.</p>}
      {swapQuote.isError && <p className="warn">Could not quote the FUSD → SPY loop. Try again before submitting.</p>}
      {chainState.isError && <p className="warn">Could not verify the Multiply deployment or wallet state.</p>}
      {upfrontFee.isError && <p className="warn">Could not quote the upfront fee. Try again before submitting.</p>}
      {error && <p className="warn" role="alert">{error}</p>}
      {txHash && pending && (
        <p className="swap__usd"><a href={`${robinhoodTestnet.blockExplorers.default.url}/tx/${txHash}`} target="_blank" rel="noreferrer">View pending transaction ↗</a></p>
      )}

      <Button
        variant="primary"
        disabled={wallet.connected && (!zapperConfigured || !active || unsafe || belowMinimumDebt || insufficientSpy || insufficientEth || pending || !oraclePrice.data || !chainState.data || upfrontFee.data === undefined)}
        onClick={() => void openMultiplyPosition()}
      >
        {buttonLabel}
      </Button>
      <RisksDialog />
    </div>
  );
}
