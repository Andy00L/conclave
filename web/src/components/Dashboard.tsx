"use client";

import { Flame, Lock, ShieldCheck, Wallet } from "lucide-react";
import { useAccount } from "wagmi";
import { BallotList } from "@/components/ballots/BallotList";
import { CreateBallotForm } from "@/components/ballots/CreateBallotForm";
import { TreasuryCard } from "@/components/treasury/TreasuryCard";
import { microLabelClasses } from "@/components/ui/field";
import { CONTRACTS_CONFIGURED } from "@/lib/addresses";
import { useBallots } from "@/lib/ballots/useBallots";

/// One step of the privacy pipeline under the hero.
function PipelineStep({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted">
      <span className="text-ember" aria-hidden="true">
        {icon}
      </span>
      {label}
    </span>
  );
}

export function Dashboard() {
  const { isConnected } = useAccount();
  const { refetch } = useBallots();

  return (
    <div className="space-y-12">
      <section className="max-w-2xl">
        <p className={`${microLabelClasses} text-ember`}>Confidential governance on Ethereum</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight tracking-tight md:text-5xl">
          Vote in private.
          <br />
          Reveal only the outcome.
        </h1>
        <p className="mt-5 max-w-prose text-muted">
          Every vote is encrypted before it leaves the browser and stays encrypted on-chain. At close, only the
          aggregate result is decrypted. A passing ballot pays its beneficiary a confidential amount from the treasury.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
          <PipelineStep icon={<Lock size={15} />} label="Vote encrypted" />
          <span className="text-line" aria-hidden="true">
            &rarr;
          </span>
          <PipelineStep icon={<ShieldCheck size={15} />} label="Tally sealed" />
          <span className="text-line" aria-hidden="true">
            &rarr;
          </span>
          <PipelineStep icon={<Flame size={15} />} label="Outcome revealed" />
        </div>
      </section>

      {!CONTRACTS_CONFIGURED ? (
        <div className="flex items-start gap-3 rounded-lg border border-line bg-surface p-6 text-sm text-muted">
          <Lock size={16} className="mt-0.5 shrink-0 text-ember" aria-hidden="true" />
          <p>
            Contracts are not configured yet. Deploy to Sepolia, then set NEXT_PUBLIC_BALLOT_ADDRESS and
            NEXT_PUBLIC_GOV_TOKEN_ADDRESS.
          </p>
        </div>
      ) : (
        <>
          {!isConnected && (
            <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-5 py-4 text-sm text-muted">
              <Wallet size={16} className="shrink-0 text-ember" aria-hidden="true" />
              Ballots are public below. Connect a wallet to vote, create ballots, and fund the treasury.
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <h2 className="font-serif text-xl tracking-tight">Ballots</h2>
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
