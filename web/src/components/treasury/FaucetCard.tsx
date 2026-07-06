"use client";

import { Check, Droplets, ExternalLink } from "lucide-react";
import { useState } from "react";
import { parseUnits } from "viem";
import { useReadContract } from "wagmi";
import { ActionButton } from "@/components/ui/ActionButton";
import { microLabelClasses } from "@/components/ui/field";
import { ConfidentialGovTokenAbi } from "@/lib/abi/ConfidentialGovToken";
import { GOV_TOKEN_ADDRESS } from "@/lib/addresses";
import type { Failure } from "@/lib/result";
import { mintConfidentialTokens } from "@/lib/token/actions";
import { useAsyncAction } from "@/lib/useAsyncAction";
import { useOnchainClients } from "@/lib/useOnchainClients";

// Google's Sepolia faucet: 0.05 ETH per day with a Google account, no token
// gating. sourceRef: cloud.google.com/application/web3/faucet/ethereum/sepolia
const SEPOLIA_ETH_FAUCET_URL = "https://cloud.google.com/application/web3/faucet/ethereum/sepolia";

// Whole cGOV minted per click: enough to create and fund a demo ballot.
// Minting is open on this testnet token (ConfidentialGovToken.sol).
const FAUCET_MINT_AMOUNT_CGOV = "100";

/// Test-token starter for a freshly connected wallet. TreasuryCard funds the
/// ballot contract; nothing existing covered the caller's own wallet, so this
/// card links the Sepolia ETH faucet and mints cGOV to the caller.
export function FaucetCard() {
  const { requireWriteClients, isConnected } = useOnchainClients();
  const { run, pendingKey, isPending, error } = useAsyncAction();
  const [hasMinted, setHasMinted] = useState(false);

  const { data: decimals } = useReadContract({
    abi: ConfidentialGovTokenAbi,
    address: GOV_TOKEN_ADDRESS,
    functionName: "decimals",
  });

  const submitMintToSelf = async (): Promise<{ ok: true } | Failure> => {
    if (!GOV_TOKEN_ADDRESS) return { ok: false, reason: "Contracts are not configured." };
    if (decimals === undefined) return { ok: false, reason: "Token decimals are still loading. Retry in a moment." };
    const clients = requireWriteClients();
    if (!clients.ok) return clients;
    const result = await mintConfidentialTokens(
      {
        publicClient: clients.publicClient,
        walletClient: clients.walletClient,
        getInstance: clients.getInstance,
        tokenAddress: GOV_TOKEN_ADDRESS,
      },
      {
        recipient: clients.walletClient.account.address,
        amount: parseUnits(FAUCET_MINT_AMOUNT_CGOV, decimals),
      },
    );
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
        Fresh wallet? Grab Sepolia ETH for gas first, then mint yourself cGOV to create and fund ballots.
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
            <p className="mt-1 text-[13px] text-muted">The confidential governance token.</p>
          </div>
          <ActionButton
            size="sm"
            label={`Mint ${FAUCET_MINT_AMOUNT_CGOV} cGOV`}
            pendingLabel="Minting..."
            isPending={pendingKey === "mint-self"}
            disabled={isPending || !isConnected}
            onClick={() => void run("mint-self", submitMintToSelf)}
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
