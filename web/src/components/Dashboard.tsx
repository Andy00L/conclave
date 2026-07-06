"use client";

import { Flame, Lock, Shield, Wallet } from "lucide-react";
import { useAccount } from "wagmi";
import { BallotList } from "@/components/ballots/BallotList";
import { CreateBallotForm } from "@/components/ballots/CreateBallotForm";
import { FaucetCard } from "@/components/treasury/FaucetCard";
import { TreasuryCard } from "@/components/treasury/TreasuryCard";
import { microLabelClasses } from "@/components/ui/field";
import { CONTRACTS_CONFIGURED } from "@/lib/addresses";
import { useBallots } from "@/lib/ballots/useBallots";

// Page entrance choreography (docs/UI_DESIGN_SYSTEM.md): the hero rises
// first, then each region follows in a tight cascade so the page settles
// within about half a second.
const NOTICE_DELAY_MS = 80;
const SECTION_DELAY_MS = 120;
const FORM_DELAY_MS = 210;
const TREASURY_DELAY_MS = 260;
const FAUCET_DELAY_MS = 310;

/// One step of the privacy pipeline under the hero, joined by hairlines.
function PipelineStep({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-sm font-medium text-ink">
      <span
        className="flex size-9 items-center justify-center rounded-full border border-line-strong bg-card shadow-contact"
        aria-hidden="true"
      >
        {icon}
      </span>
      {label}
    </span>
  );
}

function PipelineJoint() {
  return <span className="h-px w-8 bg-line-strong" aria-hidden="true" />;
}

export function Dashboard() {
  const { isConnected } = useAccount();
  const { data: ballots, refetch } = useBallots();

  return (
    <div className="space-y-10">
      <section className="max-w-[44rem] animate-rise-lg">
        <p className={`${microLabelClasses} text-bronze`}>Confidential governance on Ethereum</p>
        <h1 className="mt-3.5 font-serif text-[40px] font-[550] leading-[1.08] tracking-tight text-balance md:text-[52px]">
          Vote in private.
          <br />
          Reveal only the outcome.
        </h1>
        <p className="mt-4.5 max-w-[40rem] text-base text-muted">
          Every vote is encrypted before it leaves the browser and stays encrypted on-chain. At close, only the
          aggregate result is decrypted. A passing ballot pays its beneficiary a confidential amount from the treasury.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <PipelineStep icon={<Lock size={15} />} label="Vote encrypted" />
          <PipelineJoint />
          <PipelineStep icon={<Shield size={15} />} label="Tally sealed" />
          <PipelineJoint />
          <PipelineStep icon={<Flame size={15} />} label="Outcome revealed" />
        </div>
      </section>

      {!CONTRACTS_CONFIGURED ? (
        <div className="card animate-rise flex items-start gap-3 p-6 text-sm text-muted" style={{ animationDelay: `${NOTICE_DELAY_MS}ms` }}>
          <Lock size={16} className="mt-0.5 shrink-0 text-bronze" aria-hidden="true" />
          <p>
            Contracts are not configured yet. Deploy to Sepolia, then set NEXT_PUBLIC_BALLOT_ADDRESS and
            NEXT_PUBLIC_GOV_TOKEN_ADDRESS.
          </p>
        </div>
      ) : (
        <>
          {!isConnected && (
            <div
              className="card animate-rise flex items-center gap-3 px-5 py-3.5 text-sm text-muted"
              style={{ animationDelay: `${NOTICE_DELAY_MS}ms` }}
            >
              <Wallet size={16} className="shrink-0" aria-hidden="true" />
              Ballots are public below. Connect a wallet to vote, create ballots, and fund the treasury.
            </div>
          )}
          <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="min-w-0 space-y-4">
              <div
                className="animate-rise flex items-baseline justify-between px-0.5"
                style={{ animationDelay: `${SECTION_DELAY_MS}ms` }}
              >
                <h2 className="font-serif text-2xl font-semibold tracking-tight">Ballots</h2>
                {ballots && ballots.length > 0 && (
                  <span className={`${microLabelClasses} tabular whitespace-nowrap`}>{ballots.length} on-chain</span>
                )}
              </div>
              <BallotList />
            </div>
            <div className="min-w-0 space-y-6">
              <div className="animate-rise" style={{ animationDelay: `${FORM_DELAY_MS}ms` }}>
                <CreateBallotForm onCreated={() => void refetch()} />
              </div>
              <div className="animate-rise" style={{ animationDelay: `${TREASURY_DELAY_MS}ms` }}>
                <TreasuryCard />
              </div>
              <div className="animate-rise" style={{ animationDelay: `${FAUCET_DELAY_MS}ms` }}>
                <FaucetCard />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
