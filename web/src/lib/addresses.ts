import { getAddress, isAddress, type Address } from "viem";

// Sepolia only. Contract addresses are injected at build time through
// NEXT_PUBLIC_* env vars (see .env.example), set after running
// contracts/scripts/deploy.ts.
export const SEPOLIA_CHAIN_ID = 11155111;

// Sepolia RPC used for both wagmi reads and the FHE instance. Overridable via env.
const rawRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
export const SEPOLIA_RPC_URL =
  rawRpcUrl && rawRpcUrl.length > 0 ? rawRpcUrl : "https://ethereum-sepolia-rpc.publicnode.com";

function readAddress(rawValue: string | undefined): Address | undefined {
  if (!rawValue || !isAddress(rawValue)) return undefined;
  return getAddress(rawValue);
}

export const BALLOT_ADDRESS = readAddress(process.env.NEXT_PUBLIC_BALLOT_ADDRESS);
export const GOV_TOKEN_ADDRESS = readAddress(process.env.NEXT_PUBLIC_GOV_TOKEN_ADDRESS);

export const CONTRACTS_CONFIGURED = BALLOT_ADDRESS !== undefined && GOV_TOKEN_ADDRESS !== undefined;
