"use client";

import { useCallback, useState } from "react";
import type { Failure } from "@/lib/result";

type AsyncOutcome = { ok: true } | Failure;

type RunOptions = {
  onSuccess?: () => void;
};

/// Shared pending/error state for buttons that fire an errors-as-values action.
/// `pendingKey` identifies which button is running so sibling buttons can
/// disable themselves without each holding its own state.
export function useAsyncAction() {
  const [pendingKey, setPendingKey] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const run = useCallback(
    async (key: string, performAction: () => Promise<AsyncOutcome>, options?: RunOptions): Promise<void> => {
      setPendingKey(key);
      setError(undefined);
      const outcome = await performAction();
      setPendingKey(undefined);
      if (!outcome.ok) {
        setError(outcome.reason);
        return;
      }
      options?.onSuccess?.();
    },
    [],
  );

  const clearError = useCallback(() => setError(undefined), []);

  return { run, pendingKey, isPending: pendingKey !== undefined, error, clearError };
}
