"use client";

import { TriangleAlert } from "lucide-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { ActionButton } from "@/components/ui/ActionButton";
import { SealStamp } from "@/components/ui/SealStamp";
import { SEPOLIA_CHAIN_ID } from "@/lib/addresses";
import { shortenAddress } from "@/lib/format";

export function Header() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const injectedConnector = connectors[0];
  const onSepolia = chainId === SEPOLIA_CHAIN_ID;

  return (
    // Structural glass: the header floats over scrolling ballots, so the
    // translucency shows the overlap. Solid ink fallback when blur is unsupported.
    <header className="sticky top-0 z-40 border-b border-line bg-ink supports-[backdrop-filter]:bg-ink/70 supports-[backdrop-filter]:backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <SealStamp size={20} />
          <span className="font-serif text-xl tracking-tight">Conclave</span>
          <span className="mt-0.5 hidden font-mono text-[11px] uppercase tracking-[0.14em] text-faint sm:inline">
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
              className="tabular inline-flex items-center gap-2 rounded-full border border-line bg-raised/40 px-3 py-1.5 font-mono text-xs text-muted"
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
          <ActionButton
            label="Connect wallet"
            pendingLabel="Connecting..."
            isPending={isPending}
            disabled={!injectedConnector}
            onClick={() => {
              if (injectedConnector) connect({ connector: injectedConnector });
            }}
          />
        )}
      </div>
    </header>
  );
}
