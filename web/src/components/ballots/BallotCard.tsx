"use client";

import { Check, Clock, Copy } from "lucide-react";
import { useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useReadContract } from "wagmi";
import { ActionButton } from "@/components/ui/ActionButton";
import { microLabelClasses } from "@/components/ui/field";
import { SealedChip } from "@/components/ui/SealedChip";
import { SealStamp } from "@/components/ui/SealStamp";
import { ConfidentialGovTokenAbi } from "@/lib/abi/ConfidentialGovToken";
import { BALLOT_ADDRESS, GOV_TOKEN_ADDRESS } from "@/lib/addresses";
import {
  castVote,
  closeBallot,
  executePayout,
  resolveBallot,
  withdrawStake,
  type BallotActionContext,
} from "@/lib/ballots/actions";
import { BallotState, type BallotView } from "@/lib/ballots/useBallots";
import { describeTimeLeft, formatUnixTime, shortenAddress } from "@/lib/format";
import type { Failure } from "@/lib/result";
import { useAsyncAction } from "@/lib/useAsyncAction";
import { useCountUp } from "@/lib/useCountUp";
import { useOnchainClients } from "@/lib/useOnchainClients";

// Reveal choreography (docs/UI_DESIGN_SYSTEM.md): the bar grows 420ms while
// the counts count up 520ms, then the wax seal stamps in as the punctuation.
const SEAL_DELAY_AFTER_BAR_MS = 540;

// Positive decimal number, e.g. "10" or "2.5".
const AMOUNT_PATTERN = /^[0-9]+(\.[0-9]+)?$/;

function StateBadge({ ballot }: { ballot: BallotView }) {
  // `live` marks the one open ballot: its dot breathes so the eye lands on the
  // ballot that can actually be acted on. Every other state stays still.
  const badge =
    ballot.state === BallotState.Resolved
      ? ballot.passed
        ? { label: "Passed", dot: "bg-yes", text: "text-yes", wash: "bg-yes/10", live: false }
        : { label: "Rejected", dot: "bg-no", text: "text-no", wash: "bg-no/10", live: false }
      : ballot.state === BallotState.Revealing
        ? { label: "Sealed", dot: "bg-muted", text: "text-ink", wash: "bg-ink/10", live: false }
        : { label: "Voting", dot: "bg-bronze", text: "text-bronze-deep", wash: "bg-bronze/10", live: true };
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${badge.wash} ${badge.text}`}
    >
      <span
        className={`inline-block size-1.5 rounded-full ${badge.dot} ${badge.live ? "animate-pulse-dot" : ""}`}
        aria-hidden="true"
      />
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
      className="tabular inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-well px-2 py-1 font-mono text-xs text-ink shadow-well transition-[border-color] duration-150 ease-soft hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze/70"
    >
      {shortenAddress(address)}
      {hasCopied ? (
        <Check size={12} className="text-yes" aria-hidden="true" />
      ) : (
        <Copy size={12} className="text-muted" aria-hidden="true" />
      )}
      <span className="sr-only">{hasCopied ? "Address copied" : "Copy beneficiary address"}</span>
    </button>
  );
}

// Whole-cGOV integer from an encrypted base-unit weight, for the count-up.
function toWholeTokens(weight: bigint, decimals: number | undefined): number {
  if (decimals === undefined) return 0;
  return Math.round(Number(formatUnits(weight, decimals)));
}

/// The hero moment (docs/UI_DESIGN_SYSTEM.md): the reveal. The winning side
/// carries the solid verdict color, the losing side its wash; the bar grows
/// once, the staked weights count up beside it, in cGOV.
function TallyBar({
  yesWeight,
  noWeight,
  passed,
  revealDelayMs,
  decimals,
}: {
  yesWeight: bigint;
  noWeight: bigint;
  passed: boolean;
  revealDelayMs: number;
  decimals: number | undefined;
}) {
  const displayedYes = useCountUp(toWholeTokens(yesWeight, decimals), revealDelayMs);
  const displayedNo = useCountUp(toWholeTokens(noWeight, decimals), revealDelayMs);
  const total = yesWeight + noWeight;
  const yesShare = total === 0n ? 0 : Number((yesWeight * 10000n) / total) / 100;
  return (
    <div>
      <div
        className="animate-bar flex h-2 overflow-hidden rounded-full bg-well"
        style={{ animationDelay: `${revealDelayMs}ms` }}
      >
        {total > 0n && (
          <>
            {yesShare > 0 && <div className={passed ? "bg-yes" : "bg-yes/40"} style={{ width: `${yesShare}%` }} />}
            {yesShare < 100 && <div className={`flex-1 ${passed ? "bg-no/40" : "bg-no"}`} />}
          </>
        )}
      </div>
      <div className="mt-2.5 flex items-baseline gap-3.5 font-mono text-[13px]">
        <span className="tabular text-yes">{displayedYes} cGOV yes</span>
        <span className="tabular text-no">{displayedNo} cGOV no</span>
      </div>
    </div>
  );
}

export function BallotCard({
  ballot,
  nowMilliseconds,
  revealDelayMs,
  onChanged,
}: {
  ballot: BallotView;
  // Timestamp of the last ballots fetch. Using it instead of Date.now() keeps
  // rendering pure; it refreshes with every refetch, close enough for a countdown.
  nowMilliseconds: number;
  // When this card's reveal starts, staged by the list so one reveals at a time.
  revealDelayMs: number;
  onChanged: () => void;
}) {
  const { requireWriteClients, isConnected } = useOnchainClients();
  const { run, pendingKey, isPending, error } = useAsyncAction();
  const [stake, setStake] = useState("");

  const { data: decimals } = useReadContract({
    abi: ConfidentialGovTokenAbi,
    address: GOV_TOKEN_ADDRESS,
    functionName: "decimals",
  });

  const votingIsOpen = ballot.state === BallotState.Active && nowMilliseconds / 1000 <= Number(ballot.endTime);
  const waitingForClose = ballot.state === BallotState.Active && !votingIsOpen;
  const timeLeftLabel = describeTimeLeft(ballot.endTime, nowMilliseconds);
  const sealDelayMs = revealDelayMs + SEAL_DELAY_AFTER_BAR_MS;

  const stakeIsValid = decimals !== undefined && AMOUNT_PATTERN.test(stake.trim());
  const stakeWeight = stakeIsValid ? parseUnits(stake.trim(), decimals) : 0n;

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
    onDone: () => void = onChanged,
  ) => run(key, withContext(performAction), { onSuccess: onDone });

  const submitVote = (support: boolean) =>
    runBallotAction(support ? "vote-yes" : "vote-no", (context) =>
      castVote(context, { ballotId: ballot.id, support, weight: stakeWeight }),
    );

  const canVote = isConnected && stakeIsValid && !isPending;

  return (
    <article className="card card-interactive p-6">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-serif text-xl font-[550] leading-snug tracking-tight text-balance">
          {ballot.description}
        </h3>
        <StateBadge ballot={ballot} />
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-2">
        <span className={`${microLabelClasses} tabular`}>Ballot {ballot.id.toString()}</span>
        <span className="text-faint" aria-hidden="true">
          &middot;
        </span>
        <span className={microLabelClasses}>Beneficiary</span>
        <BeneficiaryChip address={ballot.beneficiary} />
        <span className="text-faint" aria-hidden="true">
          &middot;
        </span>
        <SealedChip label="payout" />
      </div>

      <div className="mt-3.5">
        {ballot.state === BallotState.Resolved ? (
          <div className="mt-1 space-y-3">
            <TallyBar
              yesWeight={ballot.yesWeight}
              noWeight={ballot.noWeight}
              passed={ballot.passed}
              revealDelayMs={revealDelayMs}
              decimals={decimals}
            />
            <p
              className="animate-fade inline-flex items-center gap-2 text-sm text-muted"
              style={{ animationDelay: `${sealDelayMs}ms` }}
            >
              <SealStamp
                size={20}
                tone={ballot.passed ? "yes" : "no"}
                className="animate-stamp"
                style={{ animationDelay: `${sealDelayMs}ms` }}
              />
              {ballot.passed
                ? ballot.executed
                  ? "Confidential payout sent to the beneficiary."
                  : "Passed. The confidential payout is ready to send."
                : "Rejected. The treasury keeps its funds."}
            </p>
          </div>
        ) : votingIsOpen ? (
          <p className="tabular inline-flex items-center gap-2 text-sm text-muted">
            <Clock size={14} className="shrink-0" aria-hidden="true" />
            {timeLeftLabel ?? "Closing soon"}, closes {formatUnixTime(ballot.endTime)}
          </p>
        ) : waitingForClose ? (
          <p className="text-sm text-muted">Voting has ended. Close the ballot to seal the tallies for decryption.</p>
        ) : (
          <p className="text-sm text-muted">Tallies are sealed. Reveal the result to bring the cleartext on-chain.</p>
        )}
      </div>

      <div className="mt-4.5 flex flex-wrap items-center gap-2.5">
        {votingIsOpen &&
          (ballot.viewerHasVoted ? (
            <span className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink">
              <Check size={15} className="text-yes" aria-hidden="true" />
              Your encrypted vote is in.
            </span>
          ) : (
            <>
              <label className="flex items-center gap-1.5 rounded-full border border-line bg-well py-1 pr-1 pl-3.5 shadow-well transition-[border-color] duration-150 ease-soft hover:border-line-strong">
                <span className={microLabelClasses}>Stake</span>
                <input
                  value={stake}
                  onChange={(event) => setStake(event.target.value)}
                  placeholder="10"
                  inputMode="decimal"
                  autoComplete="off"
                  disabled={isPending || !isConnected}
                  aria-label="Stake in cGOV"
                  className="tabular h-9 w-16 min-w-0 border-none bg-transparent text-center font-mono text-[13px] text-ink placeholder:text-faint focus:outline-none disabled:cursor-not-allowed disabled:text-faint"
                />
                <span className="pr-2 font-mono text-[11px] text-faint">cGOV</span>
              </label>
              <ActionButton
                label="Vote yes"
                pendingLabel="Encrypting vote..."
                isPending={pendingKey === "vote-yes"}
                disabled={!canVote}
                onClick={() => submitVote(true)}
              />
              <ActionButton
                label="Vote no"
                pendingLabel="Encrypting vote..."
                isPending={pendingKey === "vote-no"}
                disabled={!canVote}
                tone="quiet"
                onClick={() => submitVote(false)}
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

        {ballot.state === BallotState.Resolved && ballot.viewerHasVoted && !ballot.viewerHasWithdrawn && (
          <ActionButton
            label="Withdraw stake"
            pendingLabel="Withdrawing..."
            isPending={pendingKey === "withdraw"}
            disabled={isPending || !isConnected}
            tone="quiet"
            onClick={() => runBallotAction("withdraw", (context) => withdrawStake(context, { ballotId: ballot.id }))}
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
