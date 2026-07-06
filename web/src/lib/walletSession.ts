// Wallet session persistence. The user asked for an explicit disconnect to
// survive a page refresh, so a small persisted flag records "the user chose to
// disconnect". WalletReconnector reads it to decide whether to auto-reconnect
// on load, which is the only sanctioned localStorage use in the app.
const MANUAL_DISCONNECT_KEY = "conclave.wallet.manualDisconnect";

/// Record that the user disconnected on purpose, so the next load does not
/// silently reconnect them.
export function markManualDisconnect(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MANUAL_DISCONNECT_KEY, "true");
}

/// Clear the flag when the user connects again.
export function clearManualDisconnect(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(MANUAL_DISCONNECT_KEY);
}

/// Whether the user's last action was an explicit disconnect.
export function isManualDisconnect(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MANUAL_DISCONNECT_KEY) === "true";
}

// Minimal shape of an EIP-1193 provider that can revoke permissions (EIP-2255).
type RevocableProvider = {
  request: (args: { method: string; params: unknown[] }) => Promise<unknown>;
};

function canRevoke(provider: unknown): provider is RevocableProvider {
  return (
    typeof provider === "object" &&
    provider !== null &&
    "request" in provider &&
    typeof provider.request === "function"
  );
}

/// Ask the wallet to forget this site (EIP-2255 wallet_revokePermissions).
/// Without this, MetaMask keeps the site authorized and wagmi silently
/// reconnects on the next load even after a disconnect. Best-effort: wallets
/// that do not implement revoke fall back to the manual-disconnect flag.
export async function revokeWalletPermissions(provider: unknown): Promise<void> {
  if (!canRevoke(provider)) return;
  try {
    await provider.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
  } catch {
    // Wallet does not support revoke, or the user dismissed it. The flag holds.
  }
}
