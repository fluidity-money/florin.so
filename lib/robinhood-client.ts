import { createPublicClient, http } from 'viem';
import { robinhoodTestnet } from '@reown/appkit/networks';

export const robinhoodPublicClient = createPublicClient({
  chain: robinhoodTestnet,
  transport: http(),
});
