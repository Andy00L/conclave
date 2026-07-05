"use client";

import { TriangleAlert } from "lucide-react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { ActionButton } from "@/components/ui/ActionButton";
import { microLabelClasses } from "@/components/ui/field";
import { SealStamp } from "@/components/ui/SealStamp";
import { SEPOLIA_CHAIN_ID } from "@/lib/addresses";
import { shortenAddress } from "@/lib/format";

/// Human phrasing for a failed connect attempt. Distinct failure modes get
/// distinct, actionable lines; anything else surfaces the wallet's own words.
function describeConnectError(error: Error): string {
  if (error.name === "ProviderNotFoundError" || error.message.includes("Provider not found")) {
    return "No wallet found in this browser. Install MetaMask, then reload.";
  }
  if (/rejected|denied/i.test(error.message)) {
    return "Connection request rejected in the wallet.";
  }
  return "shortMessage" in error && typeof error.shortMessage === "string" ? error.shortMessage : error.message;
}

export function Header() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitchPending } = useSwitchChain();
  const injectedConnector = connectors[0];
  const onSepolia = chainId === SEPOLIA_CHAIN_ID;

  return (
    // The header floats on the paper field: paper at 80% + blur so scrolling
    // ballots show through, one hairline below. Solid paper fallback.
    <header className="sticky top-0 z-40 border-b border-line bg-paper supports-[backdrop-filter]:bg-paper/80 supports-[backdrop-filter]:backdrop-blur-md">
      <div className="mx-auto flex h-[68px] w-full max-w-[68rem] items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-2.5">
          <SealStamp size={24} />
          <span className="font-serif text-xl font-semibold tracking-tight">Conclave</span>
          <span className={`${microLabelClasses} mt-0.5 hidden sm:inline`}>confidential governance</span>
        </div>

        {isConnected && address ? (
          <div className="flex items-center gap-2">
            {onSepolia ? null : (
              <button
                onClick={() => switchChain({ chainId: SEPOLIA_CHAIN_ID })}
                disabled={isSwitchPending}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-no/10 px-3.5 text-[13px] font-medium text-no transition-[translate,scale,opacity] duration-150 ease-soft hover:-translate-y-px active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze/70"
              >
                <TriangleAlert size={13} aria-hidden="true" />
                {isSwitchPending ? "Switching..." : "Switch to Sepolia"}
              </button>
            )}
            <span
              className="tabular inline-flex h-9 items-center gap-2 rounded-full border border-line bg-well px-3.5 font-mono text-xs text-ink shadow-well"
              title={onSepolia ? "Connected to Sepolia" : "Wrong network"}
            >
              <span
                className={`inline-block size-[7px] rounded-full ${onSepolia ? "bg-yes" : "bg-no"}`}
                aria-hidden="true"
              />
              {shortenAddress(address)}
            </span>
            <button
              onClick={() => disconnect()}
              className="h-9 cursor-pointer rounded-full px-3 text-sm font-medium text-muted transition-colors duration-150 ease-soft hover:bg-well hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze/70"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {connectError && (
              <span role="alert" className="max-w-56 text-right text-xs leading-tight text-no">
                {describeConnectError(connectError)}
              </span>
            )}
            <ActionButton
              label="Connect wallet"
              pendingLabel="Connecting..."
              isPending={isPending}
              disabled={!injectedConnector}
              onClick={() => {
                if (injectedConnector) connect({ connector: injectedConnector });
              }}
            />
          </div>
        )}
      </div>
    </header>
  );
}
