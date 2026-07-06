"use client";

import { Check, Droplets, ExternalLink } from "lucide-react";
import { useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { microLabelClasses } from "@/components/ui/field";
import { GOV_TOKEN_ADDRESS } from "@/lib/addresses";
import type { Failure } from "@/lib/result";
import { claimFaucet } from "@/lib/token/actions";
import { useAsyncAction } from "@/lib/useAsyncAction";
import { useOnchainClients } from "@/lib/useOnchainClients";

// Google's Sepolia faucet: 0.05 ETH per day with a Google account, no token
// gating. sourceRef: cloud.google.com/application/web3/faucet/ethereum/sepolia
const SEPOLIA_ETH_FAUCET_URL = "https://cloud.google.com/application/web3/faucet/ethereum/sepolia";

// Whole cGOV the on-chain faucet mints per claim (ConfidentialGovToken.FAUCET_AMOUNT
// is 100 * 10^6). Kept in sync with the contract constant by hand.
const FAUCET_MINT_AMOUNT_CGOV = "100";

/// Test-token starter for a freshly connected wallet. Links the Sepolia ETH
/// faucet for gas and claims a fixed cGOV amount from the token faucet, once
/// per address, so a judge can get voting weight in one click.
export function FaucetCard() {
  const { requireWriteClients, isConnected } = useOnchainClients();
  const { run, pendingKey, isPending, error } = useAsyncAction();
  const [hasMinted, setHasMinted] = useState(false);

  const submitClaimFaucet = async (): Promise<{ ok: true } | Failure> => {
    if (!GOV_TOKEN_ADDRESS) return { ok: false, reason: "Contracts are not configured." };
    const clients = requireWriteClients();
    if (!clients.ok) return clients;
    const result = await claimFaucet({
      publicClient: clients.publicClient,
      walletClient: clients.walletClient,
      getInstance: clients.getInstance,
      tokenAddress: GOV_TOKEN_ADDRESS,
    });
    if (!result.ok) return result;
    setHasMinted(true);
    return { ok: true };
  };

  return (
    <section className="card p-6">
      <div className="flex items-center gap-2">
        <Droplets size={16} aria-hidden="true" />
        <h2 className="font-serif text-xl font-semibold tracking-tight">Test tokens</h2>
      </div>
      <p className="mt-2 text-sm text-muted">
        Fresh wallet? Grab Sepolia ETH for gas first, then claim cGOV to stake on a vote or create a ballot.
      </p>

      <div className="mt-4.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className={microLabelClasses}>Sepolia ETH</span>
            <p className="mt-1 text-[13px] text-muted">Gas for every transaction.</p>
          </div>
          <ActionButton
            tone="quiet"
            size="sm"
            href={SEPOLIA_ETH_FAUCET_URL}
            label={
              <>
                Open faucet
                <ExternalLink size={13} aria-hidden="true" />
              </>
            }
          />
        </div>

        <div className="my-5 h-px bg-line" aria-hidden="true" />

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className={microLabelClasses}>cGOV</span>
            <p className="mt-1 text-[13px] text-muted">Your voting weight, once per address.</p>
          </div>
          <ActionButton
            size="sm"
            label={`Claim ${FAUCET_MINT_AMOUNT_CGOV} cGOV`}
            pendingLabel="Claiming..."
            isPending={pendingKey === "claim-faucet"}
            disabled={isPending || !isConnected}
            onClick={() => void run("claim-faucet", submitClaimFaucet)}
          />
        </div>
      </div>

      {!isConnected && (
        <p className="mt-3 text-[13px] text-muted">
          The ETH faucet opens without connecting. Connect a wallet to mint cGOV straight to it.
        </p>
      )}

      {hasMinted && !error && (
        <p className="animate-fade mt-3 flex items-start gap-1.5 text-[13px] text-muted">
          <Check size={14} className="mt-px shrink-0 text-bronze" aria-hidden="true" />
          Minted. The amount is a ciphertext on-chain; decrypt your balance in the treasury card to read it.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-no">
          {error}
        </p>
      )}
    </section>
  );
}
