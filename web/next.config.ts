import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production builds use webpack (`next build --webpack`): the Turbopack
  // build deadlocks on this project (reproduced locally and on Vercel, worker
  // stuck at 0 CPU). The empty turbopack config keeps `next dev` (Turbopack)
  // from aborting over the webpack block below.
  turbopack: {},
  // Applies to every `next build --webpack` (the production path). wagmi's
  // connector barrel pulls optional wallet packages (porto, tempo accounts)
  // that are not installed; Turbopack ignores the unresolved optionals but
  // webpack fails the build. This app only uses the injected connector, so
  // stub them out. `false` means "resolve to an empty module".
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "porto/internal": false,
      porto: false,
      accounts: false,
      "@safe-global/safe-apps-provider": false,
      "@safe-global/safe-apps-sdk": false,
      "@walletconnect/ethereum-provider": false,
      "@base-org/account": false,
      "@coinbase/wallet-sdk": false,
      "@metamask/connect-evm": false,
    };
    return config;
  },
};

export default nextConfig;
