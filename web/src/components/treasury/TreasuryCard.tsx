"use client";

import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useReadContract } from "wagmi";
import { ActionButton } from "@/components/ui/ActionButton";
import { inputClasses, microLabelClasses } from "@/components/ui/field";
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
      <div className="flex items-center gap-2">
        <LockKeyhole size={15} className="text-ember" aria-hidden="true" />
        <h2 className="font-serif text-lg tracking-tight">Treasury</h2>
      </div>
      <p className="mt-1.5 text-sm text-muted">
        The ballot contract holds confidential cGOV: its balance is a ciphertext on-chain. Fund it here, then let
        passing ballots spend it. Minting is open because cGOV is a testnet demo token.
      </p>

      <form
        className="mt-4"
        onSubmit={(event) => {
          event.preventDefault();
          void run("fund", submitFundTreasury);
        }}
      >
        <label className="block">
          <span className={microLabelClasses}>Amount (cGOV)</span>
          <div className="mt-1.5 flex gap-2">
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="1000"
              inputMode="decimal"
              autoComplete="off"
              className={`tabular ${inputClasses}`}
            />
            <div className="shrink-0">
              <ActionButton
                type="submit"
                label="Fund"
                pendingLabel="Minting..."
                isPending={pendingKey === "fund"}
                disabled={isPending || !isConnected}
              />
            </div>
          </div>
        </label>
      </form>

      <div className="mt-5 border-t border-line pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <span className={microLabelClasses}>Your balance</span>
            <p className="mt-0.5">
              {decryptedBalance !== undefined && decimals !== undefined ? (
                <span className="tabular text-fg">{formatUnits(decryptedBalance, decimals)} cGOV</span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <LockKeyhole size={12} aria-hidden="true" />
                  encrypted
                </span>
              )}
            </p>
          </div>
          <ActionButton
            label="Decrypt"
            pendingLabel="Decrypting..."
            isPending={pendingKey === "decrypt-balance"}
            disabled={isPending || !isConnected}
            tone="quiet"
            onClick={() => void run("decrypt-balance", submitDecryptBalance)}
          />
        </div>
        <p className="mt-2.5 text-xs text-muted">
          Decrypting asks the wallet for one EIP-712 signature; the relayer re-encrypts the balance to a throwaway key
          only this page holds.
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-no">
          {error}
        </p>
      )}
    </section>
  );
}
