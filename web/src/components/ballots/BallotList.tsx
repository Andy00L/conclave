"use client";

import { Vote } from "lucide-react";
import { BallotCard } from "@/components/ballots/BallotCard";
import { useBallots } from "@/lib/ballots/useBallots";

/// Card-shaped skeleton so the list does not jump when data lands.
function BallotSkeleton() {
  return (
    <div className="rounded-lg border border-line bg-surface p-5" aria-hidden="true">
      <div className="flex items-start justify-between gap-4">
        <div className="h-5 w-3/5 rounded bg-raised motion-safe:animate-pulse" />
        <div className="h-6 w-16 rounded-full bg-raised motion-safe:animate-pulse" />
      </div>
      <div className="mt-3 h-3.5 w-2/5 rounded bg-raised motion-safe:animate-pulse" />
      <div className="mt-5 h-3.5 w-1/2 rounded bg-raised motion-safe:animate-pulse" />
      <div className="mt-5 flex gap-3">
        <div className="h-10 w-24 rounded-md bg-raised motion-safe:animate-pulse" />
        <div className="h-10 w-24 rounded-md bg-raised motion-safe:animate-pulse" />
      </div>
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
      <div className="rounded-lg border border-line bg-surface p-6 text-sm">
        <p className="text-no">Loading the ballots failed. Check the RPC connection.</p>
        <button
          onClick={() => refetch()}
          className="mt-3 cursor-pointer rounded-md border border-line px-3 py-1.5 text-sm text-fg transition-colors duration-100 ease-soft hover:border-ember/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/70"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!ballots || ballots.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-line bg-surface px-6 py-12 text-center">
        <span className="flex size-11 items-center justify-center rounded-full border border-ember/30 text-ember">
          <Vote size={20} aria-hidden="true" />
        </span>
        <p className="mt-4 font-serif text-lg">No ballots yet</p>
        <p className="mt-1.5 max-w-sm text-sm text-muted">
          Create the first one with the form on the right. Votes stay encrypted until you reveal the outcome.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {ballots.map((ballot) => (
        <BallotCard
          key={ballot.id.toString()}
          ballot={ballot}
          nowMilliseconds={dataUpdatedAt}
          onChanged={() => refetch()}
        />
      ))}
    </div>
  );
}
