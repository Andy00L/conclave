"use client";

import { Vote } from "lucide-react";
import { useState } from "react";
import { BallotCard } from "@/components/ballots/BallotCard";
import { ActionButton } from "@/components/ui/ActionButton";
import { BallotState, useBallots, type BallotView } from "@/lib/ballots/useBallots";

// Entrance choreography (docs/UI_DESIGN_SYSTEM.md): the list follows the
// section header (170ms) on the one 50ms stagger constant.
const ENTRANCE_BASE_DELAY_MS = 170;
const ENTRANCE_STAGGER_MS = 50;

// Reveal staging: on first load, resolved ballots reveal one after another
// (bar 500ms + counts 700ms breathe inside the 900ms slot). A ballot the
// viewer resolves during the session reveals almost at once instead.
const REVEAL_BASE_DELAY_MS = 600;
const REVEAL_STAGGER_MS = 900;
const REVEAL_LATER_DELAY_MS = 150;

/// Card-shaped skeleton on the well color so the list does not jump when
/// data lands: title + pill, meta chips, body line, two pill buttons.
function BallotSkeleton() {
  return (
    <div className="card p-6" aria-hidden="true">
      <div className="animate-pulse-soft">
        <div className="flex items-start justify-between gap-4">
          <div className="mt-1 h-5 w-3/5 rounded-lg bg-well shadow-well" />
          <div className="h-[26px] w-[76px] rounded-full bg-well shadow-well" />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="h-3.5 w-16 rounded-lg bg-well shadow-well" />
          <div className="h-[22px] w-32 rounded-lg bg-well shadow-well" />
          <div className="h-[22px] w-25 rounded-lg bg-well shadow-well" />
        </div>
        <div className="mt-4 h-3.5 w-1/2 rounded-lg bg-well shadow-well" />
        <div className="mt-4.5 flex gap-2.5">
          <div className="h-11 w-28 rounded-full bg-well shadow-well" />
          <div className="h-11 w-26 rounded-full bg-well shadow-well" />
        </div>
      </div>
    </div>
  );
}

/// Mounted only once ballots exist, so the lazy state initializer captures
/// which ballots were already resolved at first paint: those get the staged
/// reveal; anything resolved later reveals with the short delay.
function LoadedBallotList({
  ballots,
  dataUpdatedAt,
  onChanged,
}: {
  ballots: BallotView[];
  dataUpdatedAt: number;
  onChanged: () => void;
}) {
  const [initialResolvedIds] = useState(
    () =>
      new Set(
        ballots.filter((ballot) => ballot.state === BallotState.Resolved).map((ballot) => ballot.id.toString()),
      ),
  );

  const revealDelayByBallotId = new Map<string, number>();
  let initialRevealIndex = 0;
  for (const ballot of ballots) {
    if (ballot.state !== BallotState.Resolved) continue;
    if (initialResolvedIds.has(ballot.id.toString())) {
      revealDelayByBallotId.set(ballot.id.toString(), REVEAL_BASE_DELAY_MS + initialRevealIndex * REVEAL_STAGGER_MS);
      initialRevealIndex += 1;
    } else {
      revealDelayByBallotId.set(ballot.id.toString(), REVEAL_LATER_DELAY_MS);
    }
  }

  return (
    <div className="space-y-4">
      {ballots.map((ballot, index) => (
        <div
          key={ballot.id.toString()}
          className="animate-rise"
          style={{ animationDelay: `${ENTRANCE_BASE_DELAY_MS + index * ENTRANCE_STAGGER_MS}ms` }}
        >
          <BallotCard
            ballot={ballot}
            nowMilliseconds={dataUpdatedAt}
            revealDelayMs={revealDelayByBallotId.get(ballot.id.toString()) ?? REVEAL_LATER_DELAY_MS}
            onChanged={onChanged}
          />
        </div>
      ))}
    </div>
  );
}

export function BallotList() {
  const { data: ballots, dataUpdatedAt, isLoading, isError, refetch } = useBallots();

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading ballots">
        <BallotSkeleton />
        <BallotSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card p-6 text-sm">
        <p className="text-no">Loading the ballots failed. Check the RPC connection.</p>
        <div className="mt-3">
          <ActionButton label="Retry" tone="quiet" size="sm" onClick={() => void refetch()} />
        </div>
      </div>
    );
  }

  if (!ballots || ballots.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full border border-line bg-well text-muted shadow-well">
          <Vote size={18} aria-hidden="true" />
        </span>
        <p className="font-serif text-xl font-[550] tracking-tight">No ballots yet</p>
        <p className="max-w-sm text-sm text-muted">Create the first ballot; voting stays encrypted end to end.</p>
      </div>
    );
  }

  return <LoadedBallotList ballots={ballots} dataUpdatedAt={dataUpdatedAt} onChanged={() => refetch()} />;
}
