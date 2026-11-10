import type { Address, EIP1193Provider } from 'viem';

/** Check the selected provider without prompting or choosing a different account. */
export async function requireAuthorizedAccount(provider: EIP1193Provider, account: Address): Promise<void> {
  const accounts = await provider.request({ method: 'eth_accounts' });
  if (!Array.isArray(accounts) || !accounts.some(
    (authorized) => typeof authorized === 'string' && authorized.toLowerCase() === account.toLowerCase(),
  )) {
    throw Object.assign(new Error('The connected wallet has not authorized the displayed account.'), { code: 4100 });
  }
}
