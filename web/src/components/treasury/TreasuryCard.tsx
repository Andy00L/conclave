"use client";

import { useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useReadContract } from "wagmi";
import { ConfidentialGovTokenAbi } from "@/lib/abi/ConfidentialGovToken";
import { BALLOT_ADDRESS, GOV_TOKEN_ADDRESS } from "@/lib/addresses";
import type { Failure } from "@/lib/result";
import { decryptOwnBalance, mintConfidentialTokens, type TokenActionContext } from "@/lib/token/actions";
import { useAsyncAction } from "@/lib/useAsyncAction";
import { useOnchainClients } from "@/lib/useOnchainClients";

// Positive decimal number, e.g. "10" or "2.5".
const AMOUNT_PATTERN = /^[0-9]+(\.[0-9]+)?$/;

export function TreasuryCard() {
  const { requireWriteClients, isConnected } = useOnchainClients();
  const { run, pendingKey, isPending, error } = useAsyncAction();
  const [amount, setAmount] = useState("");
  const [decryptedBalance, setDecryptedBalance] = useState<bigint | undefined>(undefined);

  const { data: decimals } = useReadContract({
    abi: ConfidentialGovTokenAbi,
    address: GOV_TOKEN_ADDRESS,
    functionName: "decimals",
  });

  const withTokenContext = (
    performAction: (context: TokenActionContext) => Promise<{ ok: true } | Failure>,
  ): (() => Promise<{ ok: true } | Failure>) => {
    return async () => {
      if (!GOV_TOKEN_ADDRESS) return { ok: false, reason: "Contracts are not configured." };
      const clients = requireWriteClients();
      if (!clients.ok) return clients;
      return performAction({
        publicClient: clients.publicClient,
        walletClient: clients.walletClient,
        getInstance: clients.getInstance,
        tokenAddress: GOV_TOKEN_ADDRESS,
      });
    };
  };

  const submitFundTreasury = withTokenContext(async (context) => {
    if (!BALLOT_ADDRESS) return { ok: false, reason: "Contracts are not configured." };
    if (!AMOUNT_PATTERN.test(amount.trim())) return { ok: false, reason: "Enter the amount as a positive number." };
    if (decimals === undefined) return { ok: false, reason: "Token decimals are still loading. Retry in a moment." };
    const result = await mintConfidentialTokens(context, {
      recipient: BALLOT_ADDRESS,
      amount: parseUnits(amount.trim(), decimals),
    });
    if (!result.ok) return result;
    setAmount("");
    return { ok: true };
  });

  const submitDecryptBalance = withTokenContext(async (context) => {
    const result = await decryptOwnBalance(context);
    if (!result.ok) return result;
    setDecryptedBalance(result.balance);
    return { ok: true };
  });

  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <h2 className="font-serif text-lg">Treasury</h2>
      <p className="mt-1 text-xs text-muted">
        The ballot contract holds confidential cGOV. Its balance is a ciphertext on-chain: fund it here, then let
        passing ballots spend it. Minting is open because cGOV is a testnet demo token.
      </p>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void run("fund", submitFundTreasury);
        }}
      >
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="1000"
          inputMode="decimal"
          className="tabular w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-fg placeholder:text-muted/60 focus:border-ember/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending || !isConnected}
          className="shrink-0 rounded-md bg-ember px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-ember-strong disabled:opacity-50"
        >
          {pendingKey === "fund" ? "Minting..." : "Fund"}
        </button>
      </form>

      <div className="mt-4 border-t border-line pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-muted">Your cGOV balance: </span>
            {decryptedBalance !== undefined && decimals !== undefined ? (
              <span className="tabular">{formatUnits(decryptedBalance, decimals)}</span>
            ) : (
              <span className="text-muted">encrypted</span>
            )}
          </div>
          <button
            onClick={() => void run("decrypt-balance", submitDecryptBalance)}
            disabled={isPending || !isConnected}
            className="shrink-0 rounded-md border border-line px-3 py-1.5 text-sm text-fg transition-colors hover:border-ember/50 disabled:opacity-50"
          >
            {pendingKey === "decrypt-balance" ? "Decrypting..." : "Decrypt"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">
          Decrypting asks the wallet for an EIP-712 signature, then the relayer re-encrypts the balance to a throwaway
          key only this page holds. Nobody else can read it.
        </p>
      </div>

      {error && <p className="mt-3 text-sm text-no">{error}</p>}
    </section>
  );
}
