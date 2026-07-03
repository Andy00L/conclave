"use client";

import { BallotCard } from "@/components/ballots/BallotCard";
import { useBallots } from "@/lib/ballots/useBallots";

export function BallotList() {
  const { data: ballots, dataUpdatedAt, isLoading, isError, refetch } = useBallots();

  if (isLoading) {
    return <div className="rounded-lg border border-line bg-surface p-6 text-sm text-muted">Loading ballots...</div>;
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6 text-sm text-no">
        Loading the ballots failed. Check the RPC connection and retry.
        <button onClick={() => refetch()} className="ml-3 underline hover:text-fg">
          Retry
        </button>
      </div>
    );
  }

  if (!ballots || ballots.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6 text-sm text-muted">
        No ballots yet. Create the first one to open a confidential vote.
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
