"use client";

import { useAccount } from "wagmi";
import { BallotList } from "@/components/ballots/BallotList";
import { CreateBallotForm } from "@/components/ballots/CreateBallotForm";
import { TreasuryCard } from "@/components/treasury/TreasuryCard";
import { CONTRACTS_CONFIGURED } from "@/lib/addresses";
import { useBallots } from "@/lib/ballots/useBallots";

export function Dashboard() {
  const { isConnected } = useAccount();
  const { refetch } = useBallots();

  return (
    <div className="space-y-10">
      <section className="max-w-2xl">
        <h1 className="font-serif text-4xl leading-tight">Vote in private. Reveal only the outcome.</h1>
        <p className="mt-4 text-muted">
          Conclave runs governance ballots where every vote stays encrypted on-chain. At close, only the aggregate
          result is decrypted. When a ballot passes, its beneficiary is paid a confidential amount from the treasury.
        </p>
      </section>

      {!CONTRACTS_CONFIGURED ? (
        <div className="rounded-lg border border-line bg-surface p-6 text-sm text-muted">
          Contracts are not configured yet. Deploy to Sepolia, then set NEXT_PUBLIC_BALLOT_ADDRESS and
          NEXT_PUBLIC_GOV_TOKEN_ADDRESS.
        </div>
      ) : (
        <>
          {!isConnected && (
            <div className="rounded-lg border border-line bg-surface p-4 text-sm text-muted">
              Ballots are public below. Connect a wallet to vote, create ballots, and fund the treasury.
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <h2 className="font-serif text-xl">Ballots</h2>
              <BallotList />
            </div>
            <div className="space-y-6">
              <CreateBallotForm onCreated={() => void refetch()} />
              <TreasuryCard />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
