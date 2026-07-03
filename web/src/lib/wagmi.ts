import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { SEPOLIA_RPC_URL } from "@/lib/addresses";

// Single source of truth for wallet and RPC config. Sepolia only, injected
// wallet (MetaMask and compatible). ssr is on because the app is Next.js.
export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(SEPOLIA_RPC_URL),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
