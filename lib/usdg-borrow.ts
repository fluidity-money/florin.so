import { isAddress, parseAbi, parseUnits, maxUint256, type Address, type PublicClient } from 'viem';
import { CONTRACTS, erc20Abi, gasCompZapperAbi } from './borrow-contract';
import { readOpeningState, quoteOpeningFromState, requireOpeningQuote, validateOpeningAmount, type OpeningState } from './opening-capacity';

// Default USDG zapper deployment; an environment override is validated at runtime.
export const USDG_ZAPPER = (process.env.NEXT_PUBLIC_USDG_ZAPPER_ADDRESS || '0xfE1dc1e65aa7CF4D35BdF46326d3a9C92b01101d') as Address;
export const USDG = '0x15470D3791D7179FeA1b9a82c5E64Eed3e057168' as const;
const EXCHANGE = '0xf7ab3619841813FFdb84aE0c8cAA2E31573d53d2' as const;
const ORACLE = '0xD3F55480CFC3B3a47084d7E8c82a430a128aDf4b' as const;
export const usdgZapperAbi = parseAbi([
	'function openTroveWithRawETHPermitSwap((uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) permit, (address owner, uint256 ownerIndex, uint256 collAmount, uint256 boldAmount, uint256 usdgAmount, uint256 upperHint, uint256 lowerHint, uint256 annualInterestRate, address batchManager, uint256 maxUpfrontFee, address addManager, address removeManager, address receiver) params) payable returns (uint256)',
]);
const wiringAbi = parseAbi([
	'function exchange() view returns (address)',
	'function usdg() view returns (address)',
	'function boldToken() view returns (address)',
	'function troveManager() view returns (address)',
	'function collToken() view returns (address)',
	'function priceFeed() view returns (address)',
	'function priceScale() view returns (uint256)',
	'function oracleScale() view returns (uint256)',
	'function decimals() view returns (uint8)',
	'function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)',
]);
export type UsdgState = {
	decimals: number; answer: bigint; priceScale: bigint; oracleScale: bigint;
	liquidity: bigint; allowance: bigint;
};
export type BorrowState = OpeningState & { swap?: UsdgState };
type Client = Pick<PublicClient, 'readContract' | 'getBlock' | 'simulateContract' | 'getChainId'>;
const same = (a: Address, b: Address) => a.toLowerCase() === b.toLowerCase();

const EXPECTED_USDG_WIRING = {
	exchange: EXCHANGE,
	usdg: USDG,
	bold: CONTRACTS.boldToken,
	manager: CONTRACTS.troveManager,
	collateral: CONTRACTS.spyToken,
	bo: CONTRACTS.borrowerOperations,
	weth: CONTRACTS.weth,
	exchangeBold: CONTRACTS.boldToken,
	exchangeToken: USDG,
	oracle: ORACLE,
} as const;

type UsdgWiring = Record<keyof typeof EXPECTED_USDG_WIRING, Address>;

function validateUsdgWiring(wiring: UsdgWiring) {
	for (const key of Object.keys(EXPECTED_USDG_WIRING) as (keyof UsdgWiring)[]) {
		if (!same(wiring[key], EXPECTED_USDG_WIRING[key])) {
			throw new Error('USDG zapper or exchange wiring does not match the SPY branch.');
		}
	}
}

export async function readUsdgOpeningState(client: Client): Promise<BorrowState> {
	if (!isAddress(USDG_ZAPPER)) throw new Error('Invalid NEXT_PUBLIC_USDG_ZAPPER_ADDRESS.');
	if (await client.getChainId() !== 46630) throw new Error('Wrong USDG borrowing network.');
	const state = await readOpeningState(client);
	const blockNumber = state.blockNumber;
	const z = { address: USDG_ZAPPER, abi: [...wiringAbi, ...gasCompZapperAbi], blockNumber } as const;
	const e = { address: EXCHANGE, abi: wiringAbi, blockNumber } as const;
	const [exchange, usdg, bold, manager, collateral, bo, weth, exchangeBold, exchangeToken, oracle, priceScale, oracleScale, decimals, boldDecimals, feedDecimals, round, liquidity, allowance, block] = await Promise.all([
		client.readContract({ ...z, functionName: 'exchange' }),
		client.readContract({ ...z, functionName: 'usdg' }),
		client.readContract({ ...z, functionName: 'boldToken' }),
		client.readContract({ ...z, functionName: 'troveManager' }),
		client.readContract({ ...z, functionName: 'collToken' }),
		client.readContract({ ...z, functionName: 'borrowerOperations' }),
		client.readContract({ ...z, functionName: 'WETH' }),
		client.readContract({ ...e, functionName: 'boldToken' }),
		client.readContract({ ...e, functionName: 'collToken' }),
		client.readContract({ ...e, functionName: 'priceFeed' }),
		client.readContract({ ...e, functionName: 'priceScale' }),
		client.readContract({ ...e, functionName: 'oracleScale' }),
		client.readContract({ address: USDG, abi: wiringAbi, functionName: 'decimals', blockNumber }),
		client.readContract({ address: CONTRACTS.boldToken, abi: wiringAbi, functionName: 'decimals', blockNumber }),
		client.readContract({ address: ORACLE, abi: wiringAbi, functionName: 'decimals', blockNumber }),
		client.readContract({ address: ORACLE, abi: wiringAbi, functionName: 'latestRoundData', blockNumber }),
		client.readContract({ address: USDG, abi: erc20Abi, functionName: 'balanceOf', args: [EXCHANGE], blockNumber }),
		client.readContract({ address: CONTRACTS.boldToken, abi: erc20Abi, functionName: 'allowance', args: [USDG_ZAPPER, EXCHANGE], blockNumber }),
		client.getBlock({ blockNumber }),
	]);
	validateUsdgWiring({ exchange, usdg, bold, manager, collateral, bo, weth, exchangeBold, exchangeToken, oracle });
	if (boldDecimals !== 18 || decimals > 18 || feedDecimals > 18
		|| priceScale !== 10n ** BigInt(18 - decimals) || oracleScale !== 10n ** BigInt(feedDecimals)) {
		throw new Error('Unsupported USDG exchange decimals or scales.');
	}
	// This testnet mock has a static price timestamp, not a heartbeat. Match its
	// validity rules; freshness is enforced on the block-pinned snapshot, not round age.
	if (round[1] <= 0n || round[3] === 0n || round[3] > block.timestamp || round[1] * priceScale > maxUint256) {
		throw new Error('USDG oracle price is invalid.');
	}
	if (allowance === 0n) throw new Error('USDG zapper is unavailable: missing FUSD allowance to the exchange. A replacement deployment is required.');
	if (liquidity === 0n) throw new Error('USDG borrowing is unavailable: the exchange has no USDG liquidity.');
	const canonical = await client.getBlock({ blockNumber });
	if (canonical.hash !== state.blockHash) throw new Error('USDG quote block changed. Refresh and review.');
	return requireOpeningQuote({ isError: false, data: { ...state, swap: { decimals, answer: round[1], priceScale, oracleScale, liquidity, allowance } } });
}

export function usdgOutput(principal: bigint, swap: UsdgState) {
	return principal * swap.oracleScale / (swap.answer * swap.priceScale);
}
export function usdgPrincipal(output: bigint, swap: UsdgState) {
	const principal = (output * swap.answer * swap.priceScale + swap.oracleScale - 1n) / swap.oracleScale;
	if (output < 0n || principal > maxUint256 || usdgOutput(principal, swap) < output) throw new Error('Invalid USDG amount.');
	return principal;
}
export function parseUsdgAmount(value: string, decimals: number) {
	if (!value.trim()) return 0n;
	if (!/^\d*(\.\d*)?$/.test(value) || (value.split('.')[1]?.length ?? 0) > decimals) throw new Error(`Enter a USDG amount with at most ${decimals} decimal places.`);
	const amount = parseUnits(value, decimals);
	if (amount > maxUint256) throw new Error('USDG amount is too large.');
	return amount;
}
export function validateUsdgSwap(principal: bigint, output: bigint, swap: UsdgState) {
	if (principal > swap.allowance) throw new Error('USDG zapper FUSD allowance is insufficient.');
	const proceeds = usdgOutput(principal, swap);
	if (proceeds < output) throw new Error('USDG price changed. Review the new FUSD debt before submitting.');
	if (proceeds > swap.liquidity) throw new Error('Insufficient USDG exchange liquidity for this swap.');
}

export async function quoteUsdgOpening(client: Client, state: BorrowState, deposit: bigint, output: bigint, rate: bigint) {
	if (!state.swap) throw new Error('USDG snapshot unavailable.');
	const swap = state.swap;
	const principal = usdgPrincipal(output, swap);
	// Invalid requested liquidity must not prevent offering a smaller valid Max.
	const quote = await quoteOpeningFromState(client, state, deposit, principal, rate);
	// Largest principal whose rounded forward output fits actual exchange reserves.
	const liquidityPrincipal = ((swap.liquidity + 1n) * swap.answer * swap.priceScale - 1n) / swap.oracleScale;
	const capped = [quote.maxPrincipal, liquidityPrincipal, swap.allowance].reduce((a, b) => a < b ? a : b);
	const maxOutput = usdgOutput(capped, swap);
	const inverse = usdgPrincipal(maxOutput, swap);
	const maxQuote = await quoteOpeningFromState(client, state, deposit, inverse, rate, false);
	validateUsdgSwap(inverse, maxOutput, swap);
	const maxUsdg = validateOpeningAmount(deposit, inverse, rate, maxQuote.fee, maxQuote.capacity) ? 0n : maxOutput;
	return { ...quote, maxUsdg };
}
