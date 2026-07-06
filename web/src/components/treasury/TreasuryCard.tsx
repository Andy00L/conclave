"use client";

import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useReadContract } from "wagmi";
import { ActionButton } from "@/components/ui/ActionButton";
import { microLabelClasses } from "@/components/ui/field";
import { SealedChip } from "@/components/ui/SealedChip";
import { ConfidentialGovTokenAbi } from "@/lib/abi/ConfidentialGovToken";
import { BALLOT_ADDRESS, GOV_TOKEN_ADDRESS } from "@/lib/addresses";
import type { Failure } from "@/lib/result";
import { fundTreasury } from "@/lib/ballots/actions";
import { decryptOwnBalance, type TokenActionContext } from "@/lib/token/actions";
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

  const submitFundTreasury = async (): Promise<{ ok: true } | Failure> => {
    if (!BALLOT_ADDRESS) return { ok: false, reason: "Contracts are not configured." };
    if (!AMOUNT_PATTERN.test(amount.trim())) return { ok: false, reason: "Enter the amount as a positive number." };
    if (decimals === undefined) return { ok: false, reason: "Token decimals are still loading. Retry in a moment." };
    const clients = requireWriteClients();
    if (!clients.ok) return clients;
    const result = await fundTreasury(
      {
        publicClient: clients.publicClient,
        walletClient: clients.walletClient,
        getInstance: clients.getInstance,
        ballotAddress: BALLOT_ADDRESS,
      },
      { amount: parseUnits(amount.trim(), decimals) },
    );
    if (!result.ok) return result;
    setAmount("");
    return { ok: true };
  };

  const submitDecryptBalance = withTokenContext(async (context) => {
    const result = await decryptOwnBalance(context);
    if (!result.ok) return result;
    setDecryptedBalance(result.balance);
    return { ok: true };
  });

  return (
    <section className="card p-6">
      <div className="flex items-center gap-2">
        <LockKeyhole size={16} aria-hidden="true" />
        <h2 className="font-serif text-xl font-semibold tracking-tight">Treasury</h2>
      </div>
      <p className="mt-2 text-sm text-muted">
        The ballot contract holds confidential cGOV: its balance is a ciphertext on-chain. Fund it from your own cGOV
        and a passing ballot pays its beneficiary from it. Voter stakes are held apart and never paid out.
      </p>

      <form
        className="mt-4.5"
        onSubmit={(event) => {
          event.preventDefault();
          void run("fund", submitFundTreasury);
        }}
      >
        <label className="block">
          <span className={microLabelClasses}>Amount (cGOV)</span>
          <div className="mt-2 flex items-center gap-1.5 rounded-full border border-line bg-well p-1 pl-3.5 shadow-well transition-[border-color] duration-150 ease-soft hover:border-line-strong">
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="1000"
              inputMode="decimal"
              autoComplete="off"
              disabled={pendingKey === "fund"}
              className="tabular h-10 min-w-0 flex-1 border-none bg-transparent font-mono text-[13px] text-ink placeholder:text-faint focus:outline-none disabled:cursor-not-allowed disabled:text-faint"
            />
            <div className="shrink-0">
              <ActionButton
                type="submit"
                label="Fund"
                pendingLabel="Funding..."
                isPending={pendingKey === "fund"}
                disabled={isPending || !isConnected}
              />
            </div>
          </div>
        </label>
      </form>

      <div className="my-5 h-px bg-line" aria-hidden="true" />

      <div>
        <span className={microLabelClasses}>Your balance</span>
        <div className="mt-2.5 flex items-center justify-between gap-3">
          {decryptedBalance !== undefined && decimals !== undefined ? (
            <span className="tabular font-mono text-base text-ink">
              {formatUnits(decryptedBalance, decimals)} cGOV
            </span>
          ) : (
            <SealedChip label="balance" />
          )}
          <ActionButton
            label="Decrypt"
            pendingLabel="Decrypting..."
            isPending={pendingKey === "decrypt-balance"}
            disabled={isPending || !isConnected}
            tone="quiet"
            size="sm"
            onClick={() => void run("decrypt-balance", submitDecryptBalance)}
          />
        </div>
        <p className="mt-2.5 text-[13px] text-muted">
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
