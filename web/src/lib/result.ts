import type { Hex } from "viem";

// Errors as values: business logic returns these instead of throwing.
// Callers branch on `ok`; only third-party boundaries (viem, relayer SDK) throw
// and are caught at the call site.
export type Failure = { ok: false; reason: string };

export type TxSuccess = { ok: true; txHash: Hex };

export type TxResult = TxSuccess | Failure;
