import { createPublicClient, http } from 'viem';
import { robinhoodTestnet } from 'viem/chains';

export const robinhoodPublicClient = createPublicClient({
  chain: robinhoodTestnet,
  transport: http(),
});
