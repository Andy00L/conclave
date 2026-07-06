"use client";

import { TriangleAlert, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain, type Connector } from "wagmi";
import { ActionButton } from "@/components/ui/ActionButton";
import { microLabelClasses } from "@/components/ui/field";
import { SealStamp } from "@/components/ui/SealStamp";
import { SEPOLIA_CHAIN_ID } from "@/lib/addresses";
import { shortenAddress } from "@/lib/format";
import { clearManualDisconnect, markManualDisconnect, revokeWalletPermissions } from "@/lib/walletSession";

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

// The generic injected connector (id "injected") has no wallet-specific name,
// so it gets a friendly fallback label; discovered wallets carry their own.
function walletLabel(connector: Connector): string {
  return connector.id === "injected" ? "Browser wallet" : connector.name;
}

export function Header() {
  const { address, isConnected, chainId, connector: activeConnector } = useAccount();
  const { connect, connectors, isPending, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitchPending } = useSwitchChain();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const onSepolia = chainId === SEPOLIA_CHAIN_ID;

  // Discovered EIP-6963 wallets carry their own id and icon; the configured
  // injected() fallback keeps its "injected" id. Prefer the discovered ones so
  // the picker shows named wallets, and fall back to the generic entry when the
  // browser exposes no EIP-6963 wallet.
  const discoveredConnectors = connectors.filter((candidate) => candidate.id !== "injected");
  const walletOptions = discoveredConnectors.length > 0 ? discoveredConnectors : [...connectors];

  // Dismiss the wallet menu on an outside click or Escape.
  // External system: document pointer and key events.
  useEffect(() => {
    if (!isMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (menuRef.current && target instanceof Node && !menuRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isMenuOpen]);

  // Connect and, in the same request, ask the wallet to move to Sepolia.
  const connectWallet = (walletConnector: Connector) => {
    clearManualDisconnect();
    setIsMenuOpen(false);
    connect({ connector: walletConnector, chainId: SEPOLIA_CHAIN_ID });
  };

  const onConnectClick = () => {
    if (walletOptions.length <= 1) {
      if (walletOptions[0]) connectWallet(walletOptions[0]);
      return;
    }
    setIsMenuOpen((open) => !open);
  };

  // Mark the disconnect as deliberate and ask the wallet to forget the site, so
  // a refresh does not silently reconnect (see lib/walletSession).
  const disconnectWallet = async () => {
    markManualDisconnect();
    if (activeConnector) {
      try {
        const provider = await activeConnector.getProvider();
        await revokeWalletPermissions(provider);
      } catch {
        // The provider is already gone; the disconnect flag still holds.
      }
    }
    disconnect();
  };

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
              onClick={() => void disconnectWallet()}
              className="h-9 cursor-pointer rounded-full px-3 text-sm font-medium text-muted transition-colors duration-150 ease-soft hover:bg-well hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze/70"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div ref={menuRef} className="relative flex items-center gap-3">
            {connectError && !isMenuOpen && (
              <span role="alert" className="max-w-56 text-right text-xs leading-tight text-no">
                {describeConnectError(connectError)}
              </span>
            )}
            <ActionButton
              label="Connect wallet"
              pendingLabel="Connecting..."
              isPending={isPending}
              onClick={onConnectClick}
            />
            {isMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-[18px] border border-line bg-card p-1.5 shadow-btn">
                <p className={`${microLabelClasses} px-2.5 py-2`}>Choose a wallet</p>
                {walletOptions.map((walletConnector) => (
                  <button
                    key={walletConnector.uid}
                    onClick={() => connectWallet(walletConnector)}
                    className="flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left text-sm font-medium text-ink transition-colors duration-150 ease-soft hover:bg-well focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze/70"
                  >
                    {walletConnector.icon ? (
                      <span
                        aria-hidden="true"
                        className="size-5 shrink-0 rounded bg-contain bg-center bg-no-repeat"
                        style={{ backgroundImage: `url("${walletConnector.icon}")` }}
                      />
                    ) : (
                      <Wallet size={18} className="shrink-0 text-muted" aria-hidden="true" />
                    )}
                    {walletLabel(walletConnector)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
