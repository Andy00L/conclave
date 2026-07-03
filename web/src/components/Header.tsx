"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { SEPOLIA_CHAIN_ID } from "@/lib/addresses";
import { shortenAddress } from "@/lib/format";

export function Header() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const injectedConnector = connectors[0];
  const onSepolia = chainId === SEPOLIA_CHAIN_ID;

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-xl">Conclave</span>
          <span className="text-xs text-muted">confidential governance</span>
        </div>

        {isConnected && address ? (
          <div className="flex items-center gap-3">
            {onSepolia ? null : <span className="text-xs text-no">Switch to Sepolia</span>}
            <span className="tabular rounded-full border border-line px-3 py-1 text-sm text-muted">
              {shortenAddress(address)}
            </span>
            <button
              onClick={() => disconnect()}
              className="text-sm text-muted transition-colors hover:text-fg"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              if (injectedConnector) connect({ connector: injectedConnector });
            }}
            disabled={isPending || !injectedConnector}
            className="rounded-md bg-ember px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-ember-strong disabled:opacity-60"
          >
            {isPending ? "Connecting..." : "Connect wallet"}
          </button>
        )}
      </div>
    </header>
  );
}
