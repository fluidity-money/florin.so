'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { useState, type ReactNode } from 'react';
import { WalletProvider } from './wallet/wallet-provider';

// Top-level client provider stack: PostHog + react-query + the wallet bridge
// (Reown or an injected browser provider).
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  }));
  return (
    <PostHogProvider client={posthog}>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>{children}</WalletProvider>
      </QueryClientProvider>
    </PostHogProvider>
  );
}
