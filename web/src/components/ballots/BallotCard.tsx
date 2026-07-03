"use client";

import { Check, Clock, Copy, Lock } from "lucide-react";
import { useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { microLabelClasses } from "@/components/ui/field";
import { BALLOT_ADDRESS } from "@/lib/addresses";
import { castVote, closeBallot, executePayout, resolveBallot, type BallotActionContext } from "@/lib/ballots/actions";
import { BallotState, type BallotView } from "@/lib/ballots/useBallots";
import { describeTimeLeft, formatUnixTime, shortenAddress } from "@/lib/format";
import type { Failure } from "@/lib/result";
import { useAsyncAction } from "@/lib/useAsyncAction";
import { useOnchainClients } from "@/lib/useOnchainClients";

function StateBadge({ ballot }: { ballot: BallotView }) {
  const badge =
    ballot.state === BallotState.Resolved
      ? ballot.passed
        ? { label: "Passed", dot: "bg-yes", text: "text-yes", border: "border-yes/30" }
        : { label: "Rejected", dot: "bg-no", text: "text-no", border: "border-no/30" }
      : ballot.state === BallotState.Revealing
        ? { label: "Sealed", dot: "bg-muted", text: "text-muted", border: "border-line" }
        : { label: "Voting", dot: "bg-ember", text: "text-ember", border: "border-ember/30" };
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${badge.border} ${badge.text}`}
    >
      <span className={`inline-block size-1.5 rounded-full ${badge.dot}`} aria-hidden="true" />
      {badge.label}
    </span>
  );
}

/// Beneficiary address with click-to-copy and a transient "copied" state.
function BeneficiaryChip({ address }: { address: `0x${string}` }) {
  const [hasCopied, setHasCopied] = useState(false);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setHasCopied(true);
      // Transient feedback per craft rules; reverts after 1.5 s.
      setTimeout(() => setHasCopied(false), 1500);
    } catch {
      // Clipboard denied (permissions): the title tooltip still exposes the address.
    }
  };

  return (
    <button
      onClick={() => void copyAddress()}
      title={address}
      className="tabular inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted transition-colors duration-100 ease-soft hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/70"
    >
      {shortenAddress(address)}
      {hasCopied ? (
        <Check size={12} className="text-yes" aria-hidden="true" />
      ) : (
        <Copy size={12} aria-hidden="true" />
      )}
      <span className="sr-only">{hasCopied ? "Address copied" : "Copy beneficiary address"}</span>
    </button>
  );
}

/// The reveal moment: a proportional yes/no bar, only shown once resolved.
function TallyBar({ yesVotes, noVotes }: { yesVotes: bigint; noVotes: bigint }) {
  const total = Number(yesVotes) + Number(noVotes);
  const yesShare = total === 0 ? 0 : (Number(yesVotes) / total) * 100;
  return (
    <div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-raised" role="presentation">
        <div className="bg-yes" style={{ width: `${yesShare}%` }} />
        <div className="bg-no" style={{ width: `${100 - yesShare}%` }} />
      </div>
      <div className="mt-2.5 flex items-baseline gap-5 text-sm">
        <span className="tabular inline-flex items-center gap-1.5 text-yes">
          <span className="inline-block size-1.5 rounded-full bg-yes" aria-hidden="true" />
          {yesVotes.toString()} yes
        </span>
        <span className="tabular inline-flex items-center gap-1.5 text-no">
          <span className="inline-block size-1.5 rounded-full bg-no" aria-hidden="true" />
          {noVotes.toString()} no
        </span>
      </div>
    </div>
  );
}

export function BallotCard({
  ballot,
  nowMilliseconds,
  onChanged,
}: {
  ballot: BallotView;
  // Timestamp of the last ballots fetch. Using it instead of Date.now() keeps
  // rendering pure; it refreshes with every refetch, close enough for a countdown.
  nowMilliseconds: number;
  onChanged: () => void;
}) {
  const { requireWriteClients, isConnected } = useOnchainClients();
  const { run, pendingKey, isPending, error } = useAsyncAction();

  const votingIsOpen = ballot.state === BallotState.Active && nowMilliseconds / 1000 <= Number(ballot.endTime);
  const waitingForClose = ballot.state === BallotState.Active && !votingIsOpen;
  const timeLeftLabel = describeTimeLeft(ballot.endTime, nowMilliseconds);

  const withContext = (performAction: (context: BallotActionContext) => Promise<{ ok: true } | Failure>) => {
    return async (): Promise<{ ok: true } | Failure> => {
      if (!BALLOT_ADDRESS) return { ok: false, reason: "Contracts are not configured." };
      const clients = requireWriteClients();
      if (!clients.ok) return clients;
      return performAction({
        publicClient: clients.publicClient,
        walletClient: clients.walletClient,
        getInstance: clients.getInstance,
        ballotAddress: BALLOT_ADDRESS,
      });
    };
  };

  const runBallotAction = (
    key: string,
    performAction: (context: BallotActionContext) => Promise<{ ok: true } | Failure>,
  ) => run(key, withContext(performAction), { onSuccess: onChanged });

  return (
    <article className="rounded-lg border border-line bg-surface p-5 transition-colors duration-100 ease-soft hover:border-white/15">
      <div className="flex items-start justify-between gap-4">
        <p className="font-serif text-lg leading-snug tracking-tight">{ballot.description}</p>
        <StateBadge ballot={ballot} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={microLabelClasses}>Ballot {ballot.id.toString()}</span>
        <span className="text-line" aria-hidden="true">
          &middot;
        </span>
        <span className={microLabelClasses}>Beneficiary</span>
        <BeneficiaryChip address={ballot.beneficiary} />
        <span className="text-line" aria-hidden="true">
          &middot;
        </span>
        <span className={`${microLabelClasses} inline-flex items-center gap-1`}>
          <Lock size={11} aria-hidden="true" />
          Payout sealed
        </span>
      </div>

      <div className="mt-4">
        {ballot.state === BallotState.Resolved ? (
          <div className="space-y-2.5">
            <TallyBar yesVotes={ballot.yesVotes} noVotes={ballot.noVotes} />
            <p className="text-sm text-muted">
              {ballot.passed
                ? ballot.executed
                  ? "Confidential payout sent to the beneficiary."
                  : "Passed. The confidential payout is ready to send."
                : "Rejected. The treasury keeps its funds."}
            </p>
          </div>
        ) : votingIsOpen ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted">
            <Clock size={14} className="shrink-0 text-ember" aria-hidden="true" />
            {timeLeftLabel ?? "Closing soon"} &middot; closes {formatUnixTime(ballot.endTime)}
          </p>
        ) : waitingForClose ? (
          <p className="text-sm text-muted">Voting has ended. Close the ballot to seal the tallies for decryption.</p>
        ) : (
          <p className="text-sm text-muted">Tallies are sealed. Reveal the result to bring the cleartext on-chain.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {votingIsOpen &&
          (ballot.viewerHasVoted ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted">
              <Check size={14} className="text-yes" aria-hidden="true" />
              Your encrypted vote is in.
            </span>
          ) : (
            <>
              <ActionButton
                label="Vote yes"
                pendingLabel="Encrypting vote..."
                isPending={pendingKey === "vote-yes"}
                disabled={isPending || !isConnected}
                onClick={() =>
                  runBallotAction("vote-yes", (context) => castVote(context, { ballotId: ballot.id, support: true }))
                }
              />
              <ActionButton
                label="Vote no"
                pendingLabel="Encrypting vote..."
                isPending={pendingKey === "vote-no"}
                disabled={isPending || !isConnected}
                tone="quiet"
                onClick={() =>
                  runBallotAction("vote-no", (context) => castVote(context, { ballotId: ballot.id, support: false }))
                }
              />
            </>
          ))}

        {waitingForClose && (
          <ActionButton
            label="Close voting"
            pendingLabel="Closing..."
            isPending={pendingKey === "close"}
            disabled={isPending || !isConnected}
            onClick={() => runBallotAction("close", (context) => closeBallot(context, { ballotId: ballot.id }))}
          />
        )}

        {ballot.state === BallotState.Revealing && (
          <ActionButton
            label="Reveal result"
            pendingLabel="Decrypting tallies..."
            isPending={pendingKey === "resolve"}
            disabled={isPending || !isConnected}
            onClick={() => runBallotAction("resolve", (context) => resolveBallot(context, { ballotId: ballot.id }))}
          />
        )}

        {ballot.state === BallotState.Resolved && ballot.passed && !ballot.executed && (
          <ActionButton
            label="Send confidential payout"
            pendingLabel="Sending payout..."
            isPending={pendingKey === "execute"}
            disabled={isPending || !isConnected}
            onClick={() => runBallotAction("execute", (context) => executePayout(context, { ballotId: ballot.id }))}
          />
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-no">
          {error}
        </p>
      )}
    </article>
  );
}
