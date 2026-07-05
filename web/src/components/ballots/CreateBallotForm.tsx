"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { getAddress, isAddress, parseUnits } from "viem";
import { useReadContract } from "wagmi";
import { ActionButton } from "@/components/ui/ActionButton";
import { inputClasses, microLabelClasses, textareaClasses } from "@/components/ui/field";
import { ConfidentialGovTokenAbi } from "@/lib/abi/ConfidentialGovToken";
import { BALLOT_ADDRESS, GOV_TOKEN_ADDRESS } from "@/lib/addresses";
import { createBallot, MAX_DESCRIPTION_LENGTH } from "@/lib/ballots/actions";
import type { Failure } from "@/lib/result";
import { useAsyncAction } from "@/lib/useAsyncAction";
import { useOnchainClients } from "@/lib/useOnchainClients";

// Voting windows offered in the form, in seconds.
const DURATION_CHOICES = [
  { label: "10 minutes", seconds: 600n },
  { label: "1 hour", seconds: 3_600n },
  { label: "1 day", seconds: 86_400n },
  { label: "3 days", seconds: 259_200n },
  { label: "7 days", seconds: 604_800n },
] as const;

// Positive decimal number, e.g. "10" or "2.5".
const AMOUNT_PATTERN = /^[0-9]+(\.[0-9]+)?$/;

export function CreateBallotForm({ onCreated }: { onCreated: () => void }) {
  const { requireWriteClients, isConnected } = useOnchainClients();
  const { run, isPending, error } = useAsyncAction();
  const [description, setDescription] = useState("");
  const [durationSeconds, setDurationSeconds] = useState<bigint>(DURATION_CHOICES[2].seconds);
  const [beneficiary, setBeneficiary] = useState("");
  const [amount, setAmount] = useState("");

  const { data: decimals } = useReadContract({
    abi: ConfidentialGovTokenAbi,
    address: GOV_TOKEN_ADDRESS,
    functionName: "decimals",
  });

  const submitCreateBallot = async (): Promise<{ ok: true } | Failure> => {
    if (!BALLOT_ADDRESS) return { ok: false, reason: "Contracts are not configured." };
    if (!isAddress(beneficiary)) return { ok: false, reason: "The beneficiary is not a valid address." };
    if (!AMOUNT_PATTERN.test(amount.trim())) return { ok: false, reason: "Enter the payout as a positive number." };
    if (decimals === undefined) return { ok: false, reason: "Token decimals are still loading. Retry in a moment." };
    const clients = requireWriteClients();
    if (!clients.ok) return clients;

    const result = await createBallot(
      {
        publicClient: clients.publicClient,
        walletClient: clients.walletClient,
        getInstance: clients.getInstance,
        ballotAddress: BALLOT_ADDRESS,
      },
      {
        description,
        durationSeconds,
        beneficiary: getAddress(beneficiary),
        payoutAmount: parseUnits(amount.trim(), decimals),
      },
    );
    if (!result.ok) return result;

    setDescription("");
    setBeneficiary("");
    setAmount("");
    return { ok: true };
  };

  return (
    <form
      className="card p-6"
      onSubmit={(event) => {
        event.preventDefault();
        void run("create", submitCreateBallot, { onSuccess: onCreated });
      }}
    >
      <h2 className="font-serif text-xl font-semibold tracking-tight">New ballot</h2>
      <p className="mt-1.5 text-sm text-muted">
        The payout is encrypted before it leaves this page. If the ballot passes, the beneficiary receives that sealed
        amount from the treasury.
      </p>

      <div className="mt-4.5 space-y-4">
        <label className="block">
          <span className={microLabelClasses}>Question</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={MAX_DESCRIPTION_LENGTH}
            rows={2}
            disabled={isPending}
            placeholder="Fund the community grant?"
            className={`mt-2 ${textareaClasses}`}
          />
        </label>

        <label className="block">
          <span className={microLabelClasses}>Voting window</span>
          <span className="relative mt-2 block">
            <select
              value={durationSeconds.toString()}
              onChange={(event) => setDurationSeconds(BigInt(event.target.value))}
              disabled={isPending}
              className={`cursor-pointer appearance-none pr-9 ${inputClasses}`}
            >
              {DURATION_CHOICES.map((choice) => (
                <option key={choice.label} value={choice.seconds.toString()}>
                  {choice.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
          </span>
        </label>

        <label className="block">
          <span className={microLabelClasses}>Beneficiary address</span>
          <input
            value={beneficiary}
            onChange={(event) => setBeneficiary(event.target.value)}
            placeholder="0x..."
            spellCheck={false}
            autoComplete="off"
            disabled={isPending}
            className={`mt-2 font-mono text-[13px] ${inputClasses}`}
          />
        </label>

        <label className="block">
          <span className={microLabelClasses}>Sealed payout (cGOV)</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="100"
            inputMode="decimal"
            autoComplete="off"
            disabled={isPending}
            className={`tabular mt-2 font-mono text-[13px] ${inputClasses}`}
          />
        </label>
      </div>

      <div className="mt-4.5">
        <ActionButton
          type="submit"
          label="Create ballot"
          pendingLabel="Encrypting and creating..."
          isPending={isPending}
          disabled={!isConnected}
          fullWidth
        />
      </div>

      {!isConnected && <p className="mt-2 text-xs text-muted">Connect a wallet to create a ballot.</p>}
      {error && (
        <p role="alert" className="mt-2.5 text-sm text-no">
          {error}
        </p>
      )}
    </form>
  );
}
