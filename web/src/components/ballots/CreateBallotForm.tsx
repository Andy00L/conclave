"use client";

import { useState } from "react";
import { getAddress, isAddress, parseUnits } from "viem";
import { useReadContract } from "wagmi";
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

const inputClasses =
  "w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-fg placeholder:text-muted/60 focus:border-ember/60 focus:outline-none";

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
      className="rounded-lg border border-line bg-surface p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void run("create", submitCreateBallot, { onSuccess: onCreated });
      }}
    >
      <h2 className="font-serif text-lg">New ballot</h2>
      <p className="mt-1 text-xs text-muted">
        The payout amount is encrypted before it leaves this page. If the ballot passes, the beneficiary is paid that
        confidential amount from the treasury.
      </p>

      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="text-muted">Question</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={MAX_DESCRIPTION_LENGTH}
            rows={2}
            placeholder="Fund the community grant?"
            className={`mt-1 resize-none ${inputClasses}`}
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted">Voting window</span>
          <select
            value={durationSeconds.toString()}
            onChange={(event) => setDurationSeconds(BigInt(event.target.value))}
            className={`mt-1 ${inputClasses}`}
          >
            {DURATION_CHOICES.map((choice) => (
              <option key={choice.label} value={choice.seconds.toString()}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-muted">Beneficiary address</span>
          <input
            value={beneficiary}
            onChange={(event) => setBeneficiary(event.target.value)}
            placeholder="0x..."
            spellCheck={false}
            className={`mt-1 tabular ${inputClasses}`}
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted">Confidential payout (cGOV)</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="100"
            inputMode="decimal"
            className={`mt-1 tabular ${inputClasses}`}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending || !isConnected}
        className="mt-4 w-full rounded-md bg-ember px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-ember-strong disabled:opacity-50"
      >
        {isPending ? "Encrypting and creating..." : "Create ballot"}
      </button>

      {!isConnected && <p className="mt-2 text-xs text-muted">Connect a wallet to create a ballot.</p>}
      {error && <p className="mt-3 text-sm text-no">{error}</p>}
    </form>
  );
}
