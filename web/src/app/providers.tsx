"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { wagmiConfig } from "@/lib/wagmi";
import { FheProvider } from "@/lib/fhe/FheProvider";
import { WalletReconnector } from "@/components/WalletReconnector";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    // reconnectOnMount is off: WalletReconnector restores the session instead,
    // so it can honor an explicit disconnect and not reconnect against the
    // user's will on refresh.
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <WalletReconnector />
        <FheProvider>{children}</FheProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
