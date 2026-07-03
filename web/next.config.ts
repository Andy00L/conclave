import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only applies to `next build --webpack` (the Turbopack fallback). wagmi's
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
    };
    return config;
  },
};

export default nextConfig;
