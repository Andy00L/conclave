"use client";

import type { Account, Chain, PublicClient, Transport, WalletClient } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { SEPOLIA_CHAIN_ID } from "@/lib/addresses";
import { useFhe } from "@/lib/fhe/FheProvider";
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";
import type { Failure } from "@/lib/result";

export type WriteClients = {
  ok: true;
  publicClient: PublicClient;
  walletClient: WalletClient<Transport, Chain, Account>;
  getInstance: () => Promise<FhevmInstance>;
};

/// One place where every action button resolves its clients and preconditions,
/// so no component re-implements the wallet and network checks.
export function useOnchainClients() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { chainId, isConnected } = useAccount();
  const { getInstance } = useFhe();

  const requireWriteClients = (): WriteClients | Failure => {
    if (!publicClient) return { ok: false, reason: "No RPC client is available. Reload the page." };
    if (!walletClient) return { ok: false, reason: "Connect a wallet first." };
    if (chainId !== SEPOLIA_CHAIN_ID) return { ok: false, reason: "Switch the wallet to Sepolia first." };
    return { ok: true, publicClient, walletClient, getInstance };
  };

  return { requireWriteClients, isConnected };
}
