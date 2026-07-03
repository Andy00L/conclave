"use client";

import { BALLOT_ADDRESS } from "@/lib/addresses";
import { castVote, closeBallot, executePayout, resolveBallot, type BallotActionContext } from "@/lib/ballots/actions";
import { BallotState, type BallotView } from "@/lib/ballots/useBallots";
import { describeTimeLeft, formatUnixTime, shortenAddress } from "@/lib/format";
import type { Failure } from "@/lib/result";
import { useAsyncAction } from "@/lib/useAsyncAction";
import { useOnchainClients } from "@/lib/useOnchainClients";

function StateBadge({ ballot }: { ballot: BallotView }) {
  if (ballot.state === BallotState.Resolved) {
    return ballot.passed ? (
      <span className="rounded-full border border-yes/40 px-2.5 py-0.5 text-xs text-yes">Passed</span>
    ) : (
      <span className="rounded-full border border-no/40 px-2.5 py-0.5 text-xs text-no">Rejected</span>
    );
  }
  if (ballot.state === BallotState.Revealing) {
    return <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">Revealing</span>;
  }
  return <span className="rounded-full border border-ember/40 px-2.5 py-0.5 text-xs text-ember">Active</span>;
}

function ActionButton({
  label,
  pendingLabel,
  isPending,
  disabled,
  onClick,
  tone = "ember",
}: {
  label: string;
  pendingLabel: string;
  isPending: boolean;
  disabled: boolean;
  onClick: () => void;
  tone?: "ember" | "quiet";
}) {
  const toneClasses =
    tone === "ember"
      ? "bg-ember text-ink hover:bg-ember-strong"
      : "border border-line text-fg hover:border-ember/50";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${toneClasses}`}
    >
      {isPending ? pendingLabel : label}
    </button>
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

  const runBallotAction = (key: string, performAction: (context: BallotActionContext) => Promise<{ ok: true } | Failure>) =>
    run(key, withContext(performAction), { onSuccess: onChanged });

  return (
    <article className="rounded-lg border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-serif text-lg leading-snug">{ballot.description}</p>
          <p className="mt-1 text-xs text-muted">
            Ballot #{ballot.id.toString()} · beneficiary{" "}
            <span className="tabular">{shortenAddress(ballot.beneficiary)}</span> · payout amount confidential
          </p>
        </div>
        <StateBadge ballot={ballot} />
      </div>

      {ballot.state === BallotState.Resolved ? (
        <div className="mt-4 flex items-center gap-6 text-sm">
          <span className="tabular text-yes">{ballot.yesVotes.toString()} yes</span>
          <span className="tabular text-no">{ballot.noVotes.toString()} no</span>
          {ballot.passed ? (
            <span className="text-muted">{ballot.executed ? "Confidential payout sent." : "Payout pending."}</span>
          ) : (
            <span className="text-muted">No payout.</span>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">
          {votingIsOpen
            ? `Votes are encrypted on-chain. ${timeLeftLabel ?? ""} (closes ${formatUnixTime(ballot.endTime)})`
            : waitingForClose
              ? "Voting has ended. Close the ballot to expose the tallies for decryption."
              : "Tallies are exposed. Reveal the result to bring the cleartext on-chain."}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {votingIsOpen &&
          (ballot.viewerHasVoted ? (
            <span className="text-sm text-muted">Your encrypted vote is in.</span>
          ) : (
            <>
              <ActionButton
                label="Vote yes"
                pendingLabel="Encrypting vote..."
                isPending={pendingKey === "vote-yes"}
                disabled={isPending || !isConnected}
                onClick={() => runBallotAction("vote-yes", (context) => castVote(context, { ballotId: ballot.id, support: true }))}
              />
              <ActionButton
                label="Vote no"
                pendingLabel="Encrypting vote..."
                isPending={pendingKey === "vote-no"}
                disabled={isPending || !isConnected}
                tone="quiet"
                onClick={() => runBallotAction("vote-no", (context) => castVote(context, { ballotId: ballot.id, support: false }))}
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

      {error && <p className="mt-3 text-sm text-no">{error}</p>}
    </article>
  );
}
