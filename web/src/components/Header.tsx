"use client";

import { TriangleAlert } from "lucide-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { SEPOLIA_CHAIN_ID } from "@/lib/addresses";
import { shortenAddress } from "@/lib/format";

/// The Conclave seal: a ring with an ember at its center, the only logo mark.
function SealMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="shrink-0">
      <circle cx="10" cy="10" r="8.5" fill="none" stroke="var(--color-ember)" strokeOpacity="0.45" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="3" fill="var(--color-ember)" />
    </svg>
  );
}

export function Header() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const injectedConnector = connectors[0];
  const onSepolia = chainId === SEPOLIA_CHAIN_ID;

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <SealMark />
          <span className="font-serif text-xl tracking-tight">Conclave</span>
          <span className="mt-0.5 hidden text-xs uppercase tracking-wider text-muted sm:inline">
            confidential governance
          </span>
        </div>

        {isConnected && address ? (
          <div className="flex items-center gap-3">
            {onSepolia ? null : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-no/40 px-2.5 py-1 text-xs text-no">
                <TriangleAlert size={13} aria-hidden="true" />
                Switch to Sepolia
              </span>
            )}
            <span
              className="tabular inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm text-muted"
              title={address}
            >
              <span
                className={`inline-block size-1.5 rounded-full ${onSepolia ? "bg-yes" : "bg-no"}`}
                aria-hidden="true"
              />
              {shortenAddress(address)}
            </span>
            <button
              onClick={() => disconnect()}
              className="cursor-pointer rounded-md px-2 py-1.5 text-sm text-muted transition-colors duration-100 ease-soft hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/70"
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
            aria-busy={isPending}
            className="h-10 cursor-pointer rounded-md bg-ember px-4 text-sm font-medium text-ink transition-colors duration-100 ease-soft hover:bg-ember-strong active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:pointer-events-none disabled:opacity-50"
          >
            {isPending ? "Connecting..." : "Connect wallet"}
          </button>
        )}
      </div>
    </header>
  );
}
