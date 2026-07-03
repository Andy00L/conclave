"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address, PublicClient } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { ConfidentialBallotAbi } from "@/lib/abi/ConfidentialBallot";
import { BALLOT_ADDRESS } from "@/lib/addresses";

// Mirror of the on-chain BallotState enum (same declaration order as the contract).
export const BallotState = { Active: 0, Revealing: 1, Resolved: 2 } as const;

export type BallotView = {
  id: bigint;
  description: string;
  beneficiary: Address;
  startTime: bigint;
  endTime: bigint;
  state: number;
  yesVotes: bigint;
  noVotes: bigint;
  passed: boolean;
  executed: boolean;
  // Whether the connected wallet already voted; false when disconnected.
  viewerHasVoted: boolean;
};

// Ballots move on block timestamps (voting deadlines), so poll at a cadence
// close to Sepolia's ~12 s block time to keep states and tallies fresh.
const BALLOTS_REFETCH_INTERVAL_MS = 15_000;

async function fetchBallots(
  publicClient: PublicClient,
  ballotAddress: Address,
  viewer: Address | undefined,
): Promise<BallotView[]> {
  const count = await publicClient.readContract({
    address: ballotAddress,
    abi: ConfidentialBallotAbi,
    functionName: "ballotCount",
  });

  const ballotIds = Array.from({ length: Number(count) }, (_unused, index) => BigInt(index));
  const ballots = await Promise.all(
    ballotIds.map(async (ballotId): Promise<BallotView> => {
      const [ballot, viewerHasVoted] = await Promise.all([
        publicClient.readContract({
          address: ballotAddress,
          abi: ConfidentialBallotAbi,
          functionName: "getBallot",
          args: [ballotId],
        }),
        viewer
          ? publicClient.readContract({
              address: ballotAddress,
              abi: ConfidentialBallotAbi,
              functionName: "hasVoted",
              args: [ballotId, viewer],
            })
          : Promise.resolve(false),
      ]);
      const [description, beneficiary, startTime, endTime, state, yesVotes, noVotes, passed, executed] = ballot;
      return {
        id: ballotId,
        description,
        beneficiary,
        startTime,
        endTime,
        state,
        yesVotes,
        noVotes,
        passed,
        executed,
        viewerHasVoted,
      };
    }),
  );

  // Newest first: recent ballots are the ones people act on.
  return ballots.reverse();
}

/// All ballots plus whether the connected wallet voted on each. Refetches on
/// an interval and exposes `refetch` so actions can refresh immediately after
/// a confirmed transaction.
export function useBallots() {
  const publicClient = usePublicClient();
  const { address } = useAccount();

  return useQuery({
    queryKey: ["ballots", BALLOT_ADDRESS ?? "unconfigured", address ?? "disconnected"],
    enabled: publicClient !== undefined && BALLOT_ADDRESS !== undefined,
    refetchInterval: BALLOTS_REFETCH_INTERVAL_MS,
    queryFn: () => {
      // enabled above guarantees both are set; the checks narrow the types.
      if (!publicClient || !BALLOT_ADDRESS) return Promise.resolve([]);
      return fetchBallots(publicClient, BALLOT_ADDRESS, address);
    },
  });
}
