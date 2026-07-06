"use client";

import { useEffect, useRef } from "react";
import { useReconnect } from "wagmi";
import { isManualDisconnect } from "@/lib/walletSession";

/// Restores the wallet connection on load, unless the user explicitly
/// disconnected last time. This replaces wagmi's built-in reconnectOnMount
/// (turned off in providers.tsx) so an explicit disconnect stays sticky across
/// refreshes instead of silently reconnecting. Renders nothing.
export function WalletReconnector() {
  const { reconnect } = useReconnect();
  const hasReconnected = useRef(false);

  // External system: the wallet provider plus the persisted disconnect flag.
  // Runs once; the ref guards against a double run under React Strict Mode.
  useEffect(() => {
    if (hasReconnected.current) return;
    hasReconnected.current = true;
    if (isManualDisconnect()) return;
    reconnect();
  }, [reconnect]);

  return null;
}
