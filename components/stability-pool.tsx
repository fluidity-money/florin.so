'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { robinhoodTestnet } from '@reown/appkit/networks';
import {
  createWalletClient,
  custom,
  formatUnits,
  parseUnits,
  type Address,
  type Hash,
} from 'viem';
import { Button } from './ui';
import { Token, TokenIcon } from './token-icon';
import { parseDisplayPercent, spyMarket, type FlorinMarkets } from '../lib/florin-markets';
import { money, pct } from '../lib/format';
import { usePoolApr } from '../lib/use-pool-apr';
import { useWallet } from './wallet/wallet';
import { useFlorinMarkets, useMarketAction } from '../lib/use-florin-markets';
import { robinhoodPublicClient } from '../lib/robinhood-client';
import { captureEvent } from '../lib/analytics';
import {
  CONTRACTS,
  erc20Abi,
  MIN_FUSD_IN_STABILITY_POOL,
  ROBINHOOD_TESTNET_CHAIN_ID,
  stabilityPoolAbi,
  validateStabilityPoolAmount,
} from '../lib/borrow-contract';

// Deposit and withdraw move an amount. Claim and compound act on rewards
// already earned, so they take no amount.
type Mode = 'deposit' | 'withdraw' | 'claim' | 'compound';

const MODE_LABEL: Record<Mode, string> = {
  deposit: 'Deposit',
  withdraw: 'Withdraw',
  claim: 'Claim',
  compound: 'Compound',
};
type TxStage = 'idle' | 'switching' | 'approving' | 'submitting' | 'confirming';

function parseToken(value: string): bigint {
  if (!value.trim()) return 0n;
  try {
    return parseUnits(value, 18);
  } catch {
    return 0n;
  }
}

function errorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error || 'Unknown wallet or network error.');
  const candidate = error as { shortMessage?: unknown; details?: unknown; message?: unknown; cause?: unknown };
  for (const value of [candidate.shortMessage, candidate.details, candidate.message]) {
    if (typeof value === 'string' && value.trim()) return value.replace(/\s+/g, ' ').trim();
  }
  return candidate.cause ? errorMessage(candidate.cause) : 'Unknown wallet or network error.';
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

// Three jobs, as tabs above the field: change the deposit, claim rewards, or
// roll them back in. Only the first takes an amount.
type Tab = 'update' | 'claim' | 'compound';

const TAB_LABEL: Record<Tab, string> = {
  update: 'Update',
  claim: 'Claim rewards',
  compound: 'Compound',
};

function Tabs({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <div className="pool-tabs" role="tablist" aria-label="Stability Pool action">
			{(['update', 'compound', 'claim'] as const).map((option) => (
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

// Inside Update: which way the amount goes.
function Seg({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <span className="seg" role="group" aria-label="Deposit or withdraw">
      {(['deposit', 'withdraw'] as const).map((option) => (
        <button
          key={option}
          type="button"
          className={mode === option ? 'seg__opt seg__opt--on' : 'seg__opt'}
          aria-pressed={mode === option}
          onClick={() => onChange(option)}
        >
          {MODE_LABEL[option]}
        </button>
      ))}
    </span>
  );
}

export function StabilityPool({ initialMarkets }: { initialMarkets: FlorinMarkets }) {
  const wallet = useWallet();
  const account = wallet.address as Address | null;
  const markets = useFlorinMarkets(initialMarkets);
  const prepareMarketAction = useMarketAction();
  const { earn: rewards } = spyMarket(markets);
  const [mode, setMode] = useState<Mode>('deposit');
  const [amountStr, setAmountStr] = useState('');
  const [stage, setStage] = useState<TxStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hash | null>(null);

  const position = useQuery({
    queryKey: ['stability-pool-position', account],
    enabled: Boolean(account),
    refetchInterval: 15_000,
    queryFn: async () => {
      const [walletBalance, deposit, totalDeposits, collGain, yieldGain, stashedColl] = await Promise.all([
        robinhoodPublicClient.readContract({
          address: CONTRACTS.boldToken,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account!],
        }),
        robinhoodPublicClient.readContract({
          address: CONTRACTS.stabilityPool,
          abi: stabilityPoolAbi,
          functionName: 'getCompoundedBoldDeposit',
          args: [account!],
        }),
        robinhoodPublicClient.readContract({
          address: CONTRACTS.stabilityPool,
          abi: stabilityPoolAbi,
          functionName: 'getTotalBoldDeposits',
        }),
        robinhoodPublicClient.readContract({
          address: CONTRACTS.stabilityPool,
          abi: stabilityPoolAbi,
          functionName: 'getDepositorCollGain',
          args: [account!],
        }),
        robinhoodPublicClient.readContract({
          address: CONTRACTS.stabilityPool,
          abi: stabilityPoolAbi,
          functionName: 'getDepositorYieldGainWithPending',
          args: [account!],
        }),
        robinhoodPublicClient.readContract({
          address: CONTRACTS.stabilityPool,
          abi: stabilityPoolAbi,
          functionName: 'stashedColl',
          args: [account!],
        }),
      ]);
      return { walletBalance, deposit, totalDeposits, collGain, yieldGain, stashedColl };
    },
  });

  const realised = usePoolApr();
  const amount = useMemo(() => parseToken(amountStr), [amountStr]);
  const rewardsMode = mode === 'claim' || mode === 'compound';
  const amountMode = mode === 'withdraw' ? 'withdraw' : 'deposit';
  const available = amountMode === 'deposit'
    ? position.data?.walletBalance ?? 0n
    : position.data?.deposit ?? 0n;
  const totalDeposits = position.data?.totalDeposits ?? 0n;
  const withdrawableFromPool = totalDeposits > MIN_FUSD_IN_STABILITY_POOL
    ? totalDeposits - MIN_FUSD_IN_STABILITY_POOL
    : 0n;
  const maxAmount = amountMode === 'deposit'
    ? available
    : available < withdrawableFromPool ? available : withdrawableFromPool;
  const pending = stage !== 'idle';
  const deposit = position.data?.deposit ?? 0n;
  const fusdReward = position.data?.yieldGain ?? 0n;
  const spyReward = (position.data?.collGain ?? 0n) + (position.data?.stashedColl ?? 0n);
  const hasRewards = fusdReward > 0n || spyReward > 0n;
  // Compounding rolls FUSD rewards into an existing deposit, so it needs both.
  const canCompound = fusdReward > 0n && deposit > 0n;
  const validationError = rewardsMode
    ? null
    : validateStabilityPoolAmount(amountMode, amount, available, totalDeposits);
  const rewardsBlocked = mode === 'claim' ? !hasRewards : mode === 'compound' ? !canCompound : false;
  const coverage = parseDisplayPercent(rewards?.coverage);
  const coverageRisk = coverage === null
    ? 'high'
    : coverage >= 0.5
      ? 'ok'
      : coverage >= 0.25
        ? 'medium'
        : 'high';

  async function waitForReceipt(hash: Hash) {
    let currentHash = hash;
    let replacementInvalid = false;
    setTxHash(hash);
    setStage('confirming');
    const receipt = await robinhoodPublicClient.waitForTransactionReceipt({
      hash,
      onReplaced: (replacement) => {
        if (replacement.reason !== 'repriced') replacementInvalid = true;
        currentHash = replacement.transaction.hash;
        setTxHash(currentHash);
      },
    });
    if (replacementInvalid) throw new Error('The transaction was cancelled or replaced.');
    if (receipt.status !== 'success') throw new Error('The transaction reverted.');
    return receipt;
  }

  async function transact(action: Mode) {
    if (!wallet.connected || !account || !wallet.provider) {
      setError(null);
      try {
        await wallet.connect();
      } catch (cause) {
        setError(errorMessage(cause));
      }
      return;
    }
    if (pending) return;

    captureEvent('stability_pool_action_requested', {
      action,
      chain_id: ROBINHOOD_TESTNET_CHAIN_ID,
      wallet_kind: wallet.kind,
      coverage_risk: coverageRisk,
    });
    setError(null);
    setSuccess(null);
    setTxHash(null);
    try {
      setStage('switching');
      await ensureRobinhoodTestnet(wallet.provider);
      const walletClient = createWalletClient({
        account,
        chain: robinhoodTestnet,
        transport: custom(wallet.provider),
      });

      if (action === 'deposit') {
        const [walletBalance, allowance, currentTotalDeposits] = await Promise.all([
          robinhoodPublicClient.readContract({
            address: CONTRACTS.boldToken,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [account],
          }),
          robinhoodPublicClient.readContract({
            address: CONTRACTS.boldToken,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [account, CONTRACTS.stabilityPool],
          }),
          robinhoodPublicClient.readContract({
            address: CONTRACTS.stabilityPool,
            abi: stabilityPoolAbi,
            functionName: 'getTotalBoldDeposits',
          }),
        ]);
        const invalid = validateStabilityPoolAmount(
          'deposit',
          amount,
          walletBalance,
          currentTotalDeposits,
        );
        if (invalid) throw new Error(invalid);

        if (allowance < amount) {
          setStage('approving');
          const approval = await robinhoodPublicClient.simulateContract({
            account,
            address: CONTRACTS.boldToken,
            abi: erc20Abi,
            functionName: 'approve',
            args: [CONTRACTS.stabilityPool, amount],
          });
          await waitForReceipt(await walletClient.writeContract(approval.request));
        }

        setTxHash(null);
        setStage('submitting');
        const simulation = await robinhoodPublicClient.simulateContract({
          account,
          address: CONTRACTS.stabilityPool,
          abi: stabilityPoolAbi,
          functionName: 'provideToSP',
          args: [amount, false],
        });
        const updateMarkets = prepareMarketAction();
        const receipt = await waitForReceipt(await walletClient.writeContract(simulation.request));
        updateMarkets(receipt, { poolSize: Number(formatUnits(amount, 18)) });
        setSuccess(`${money(Number(formatUnits(amount, 18)), 2)} FUSD deposited.`);
      } else if (action === 'withdraw') {
        const [currentDeposit, currentTotalDeposits] = await Promise.all([
          robinhoodPublicClient.readContract({
            address: CONTRACTS.stabilityPool,
            abi: stabilityPoolAbi,
            functionName: 'getCompoundedBoldDeposit',
            args: [account],
          }),
          robinhoodPublicClient.readContract({
            address: CONTRACTS.stabilityPool,
            abi: stabilityPoolAbi,
            functionName: 'getTotalBoldDeposits',
          }),
        ]);
        const invalid = validateStabilityPoolAmount(
          'withdraw',
          amount,
          currentDeposit,
          currentTotalDeposits,
        );
        if (invalid) throw new Error(invalid);

        setStage('submitting');
        const simulation = await robinhoodPublicClient.simulateContract({
          account,
          address: CONTRACTS.stabilityPool,
          abi: stabilityPoolAbi,
          functionName: 'withdrawFromSP',
          args: [amount, false],
        });
        const updateMarkets = prepareMarketAction();
        const receipt = await waitForReceipt(await walletClient.writeContract(simulation.request));
        updateMarkets(receipt, { poolSize: -Number(formatUnits(amount, 18)) });
        setSuccess(`${money(Number(formatUnits(amount, 18)), 2)} FUSD withdrawn.`);
      } else if (action === 'compound') {
        // A zero withdrawal with claiming off: FUSD rewards are added to the
        // deposit and SPY rewards are set aside in the pool for a later claim.
        setStage('submitting');
        const simulation = await robinhoodPublicClient.simulateContract({
          account,
          address: CONTRACTS.stabilityPool,
          abi: stabilityPoolAbi,
          functionName: 'withdrawFromSP',
          args: [0n, false],
        });
        const updateMarkets = prepareMarketAction();
        const receipt = await waitForReceipt(await walletClient.writeContract(simulation.request));
        updateMarkets(receipt, { poolSize: Number(formatUnits(fusdReward, 18)) });
        setSuccess('FUSD rewards added to your deposit.');
      } else {
        const initialDeposit = await robinhoodPublicClient.readContract({
          address: CONTRACTS.stabilityPool,
          abi: stabilityPoolAbi,
          functionName: 'deposits',
          args: [account],
        });
        setStage('submitting');
        if (initialDeposit > 0n) {
          const simulation = await robinhoodPublicClient.simulateContract({
            account,
            address: CONTRACTS.stabilityPool,
            abi: stabilityPoolAbi,
            functionName: 'withdrawFromSP',
            args: [0n, true],
          });
          await waitForReceipt(await walletClient.writeContract(simulation.request));
        } else {
          const simulation = await robinhoodPublicClient.simulateContract({
            account,
            address: CONTRACTS.stabilityPool,
            abi: stabilityPoolAbi,
            functionName: 'claimAllCollGains',
          });
          await waitForReceipt(await walletClient.writeContract(simulation.request));
        }
        setSuccess('Stability Pool rewards claimed.');
      }

      captureEvent('stability_pool_action_succeeded', {
        action,
        chain_id: ROBINHOOD_TESTNET_CHAIN_ID,
        wallet_kind: wallet.kind,
        coverage_risk: coverageRisk,
      });
      setAmountStr('');
      await position.refetch();
    } catch (cause) {
      setError(errorMessage(cause));
      captureEvent('stability_pool_action_failed', {
        action,
        chain_id: ROBINHOOD_TESTNET_CHAIN_ID,
        wallet_kind: wallet.kind,
        coverage_risk: coverageRisk,
      });
    } finally {
      setStage('idle');
    }
  }

  const availableDisplay = Number(formatUnits(available, 18));
  const buttonLabel = !wallet.connected
    ? 'Connect wallet to continue'
    : stage === 'switching'
      ? 'Switching network…'
      : stage === 'approving'
        ? 'Approve FUSD in wallet…'
        : stage === 'submitting'
          ? 'Confirm in wallet…'
          : stage === 'confirming'
            ? 'Waiting for confirmation…'
            : mode === 'deposit'
              ? 'Deposit FUSD →'
              : mode === 'withdraw'
                ? 'Withdraw FUSD →'
                : mode === 'claim'
                  ? 'Claim rewards →'
                  : 'Compound rewards →';

  return (
    <div className="swap">
      <h1 className="swap__title">
        <span>Deposit</span>
        <span className="swap__pair">
          <TokenIcon symbol="FUSD" size={30} />
          <span className="swap__tok">FUSD</span>
        </span>
        <span>to earn rewards</span>
      </h1>
      <p className="swap__sub">
        A FUSD deposit earns a share of the interest every borrower pays. It
        also settles liquidations: when a position goes under, your FUSD is
        swapped and you are handed the SPY at a discount.
      </p>

      <div className="pool">
        <div className="pool__head">
          <div className="pool__ident">
            <TokenIcon symbol="SPY" size={30} />
            <span>
              <span className="pool__name">SPY Stability Pool</span>
              <span className="pool__tvl">TVL <b>{rewards?.poolSize ?? '—'}</b> FUSD</span>
            </span>
          </div>
          <div className="pool__aprs">
            {/* What a deposit actually earned over the last day and the last
                week, from borrower interest and upfront fees. */}
            <span title="What a deposit earned over the last 24 hours, annualised">
              APR <b>{realised.apr24h === null ? '—' : pct(realised.apr24h * 100, 2)}</b>
            </span>
            <span className="pool__apr-sub" title="What a deposit earned over the last 7 days, annualised. Shown once the pool has enough history.">
              7d APR <b>{realised.apr7d === null ? '—' : pct(realised.apr7d * 100, 2)}</b>
            </span>
          </div>
        </div>
        <div className="pool__foot">
          <span className="tok-row">Deposit <Token symbol="FUSD" size={16} /></span>
          <span className="tok-row">Rewards <Token symbol="FUSD" size={16} /> <Token symbol="SPY" size={16} /></span>
        </div>
      </div>

      <div className="pool">
        <div className="pool__head">
          <div className="pool__ident">
            <TokenIcon symbol="FUSD" size={30} />
            <span>
              <span className="pool__name">Your pool position</span>
              <span className="pool__tvl">
                Deposited <b>{wallet.connected ? money(Number(formatUnits(deposit, 18)), 2) : '—'}</b> FUSD
              </span>
            </span>
          </div>
          <div className="pool__aprs">
            <span>FUSD rewards <b>{wallet.connected ? money(Number(formatUnits(fusdReward, 18)), 4) : '—'}</b></span>
            <span className="pool__apr-sub">SPY rewards {wallet.connected ? money(Number(formatUnits(spyReward, 18)), 6) : '—'}</span>
          </div>
        </div>
        {wallet.connected && position.isError && <p className="warn">Could not load your onchain pool position.</p>}
      </div>

      <Tabs
        tab={rewardsMode ? (mode as Tab) : 'update'}
        onChange={(next) => {
          const nextMode: Mode = next === 'update' ? 'deposit' : next;
          if (nextMode === mode || (next === 'update' && !rewardsMode)) return;
          captureEvent('transaction_mode_changed', { context: 'stability_pool', mode: nextMode });
          setMode(nextMode);
          setAmountStr('');
          setError(null);
          setSuccess(null);
        }}
      />

      <div className="swap__field">
        <div className="swap__row">
          <span className="swap__label">
            {rewardsMode ? 'Rewards' : mode === 'deposit' ? 'Increase deposit' : 'Decrease deposit'}
          </span>
          {!rewardsMode && (
            <Seg mode={mode} onChange={(next) => {
              captureEvent('transaction_mode_changed', { context: 'stability_pool', mode: next });
              setMode(next);
              setAmountStr('');
              setError(null);
              setSuccess(null);
            }} />
          )}
        </div>
        {rewardsMode ? (
          <>
            {/* What each reward is, and where this action sends it. */}
            <div className="rewards">
              <div className="rewards__row">
                <span className="rewards__what">
                  <TokenIcon symbol="FUSD" size={22} />
                  <span>
                    <b>FUSD rewards</b>
                    <em>{mode === 'claim' ? 'Sent to your wallet' : 'Added to your deposit'}</em>
                  </span>
                </span>
                <span className="rewards__amount">
                  {wallet.connected ? money(Number(formatUnits(fusdReward, 18)), 4) : '—'}
                </span>
              </div>
              <div className="rewards__row">
                <span className="rewards__what">
                  <TokenIcon symbol="SPY" size={22} />
                  <span>
                    <b>SPY rewards</b>
                    <em>{mode === 'claim' ? 'Sent to your wallet' : 'Kept in the pool until you claim'}</em>
                  </span>
                </span>
                <span className="rewards__amount">
                  {wallet.connected ? money(Number(formatUnits(spyReward, 18)), 6) : '—'}
                </span>
              </div>
            </div>
            <span className="swap__usd">
              {!wallet.connected
                ? 'Connect a wallet to view your rewards'
                : rewardsBlocked
                  ? mode === 'claim'
                    ? 'No rewards to claim yet'
                    : 'No FUSD rewards to compound yet'
                  : mode === 'claim'
                    ? 'Your deposit stays in the pool'
                    : 'Compounded FUSD starts earning straight away'}
            </span>
          </>
        ) : (
          <>
            <div className="swap__row">
              <input
                className="swap__amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amountStr}
                onChange={(event) => setAmountStr(event.target.value)}
                aria-label={`FUSD to ${amountMode}`}
              />
              <button
                type="button"
                className="swap__max"
                disabled={maxAmount <= 0n}
                onClick={() => {
                  captureEvent('max_amount_selected', { context: 'stability_pool', action: amountMode, asset: 'FUSD' });
                  setAmountStr(formatUnits(maxAmount, 18));
                }}
              >
                Max
              </button>
              <span className="swap__pill"><Token symbol="FUSD" size={18} /></span>
            </div>
            <span className="swap__usd">
              {wallet.connected
                ? amountMode === 'deposit'
                  ? `${money(availableDisplay, 2)} FUSD in wallet`
                  : `${money(availableDisplay, 4)} FUSD deposited`
                : 'Connect a wallet to view your balance'}
            </span>
          </>
        )}
      </div>

      {amountStr.trim() && validationError && <p className="swap__over">{validationError}</p>}
      <details className="swap__note">
        <summary>What the pool actually does</summary>
        <p>The pool earns from two sources.</p>
        <ul>
          <li><b>Borrower interest.</b> A share of the interest borrowers pay goes to depositors as FUSD.</li>
          <li><b>Liquidations.</b> When a position is liquidated, the pool repays its debt and receives its SPY at a discount.</li>
        </ul>
      </details>

      {error && (
        <div className="swap__error" role="alert">
          <p className="warn">Transaction failed.</p>
          <p className="swap__error-explanation">{error}</p>
        </div>
      )}
      {success && <p className="swap__success" role="status">{success}</p>}
      {txHash && (
        <p className="swap__usd">
          <a href={`${robinhoodTestnet.blockExplorers.default.url}/tx/${txHash}`} target="_blank" rel="noreferrer">
            {pending ? 'View pending transaction ↗' : 'View transaction ↗'}
          </a>
        </p>
      )}

      <Button
        variant="primary"
        disabled={wallet.connected && (pending || position.isLoading || position.isError || Boolean(validationError) || rewardsBlocked)}
        onClick={() => void transact(mode)}
      >
        {buttonLabel}
      </Button>

    </div>
  );
}
