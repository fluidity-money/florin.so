import { zeroDevWallet } from '@zerodev/wallet-react-ui';
import { createConfig, http } from 'wagmi';
import { robinhoodTestnet } from 'wagmi/chains';

const projectId = (process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID ?? '').trim();
const invalidProjectIds = new Set([
  '',
  'YOUR_ZERODEV_PROJECT_ID',
  'REPLACE_ME',
]);

export const hasZeroDev = !invalidProjectIds.has(projectId);

export const wagmiConfig = createConfig({
  chains: [robinhoodTestnet],
  connectors: [
    zeroDevWallet({
      projectId: projectId || 'ZERODEV_PROJECT_ID_NOT_CONFIGURED',
      chains: [robinhoodTestnet],
      mode: '7702',
      aaHost: process.env.NEXT_PUBLIC_ZERODEV_AA_HOST ?? 'https://rpc.zerodev.app',
      autoInitialize: hasZeroDev,
    }),
  ],
  transports: {
    [robinhoodTestnet.id]: http(
      process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL
        ?? robinhoodTestnet.rpcUrls.default.http[0],
    ),
  },
  multiInjectedProviderDiscovery: false,
  ssr: true,
});
