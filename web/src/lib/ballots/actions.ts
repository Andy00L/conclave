import type { Account, Address, Chain, Hex, PublicClient, Transport, WalletClient } from "viem";
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";
import { ConfidentialBallotAbi } from "@/lib/abi/ConfidentialBallot";
import { describeTransactionError, describeUnknownError } from "@/lib/errors";
import { encryptExternalInput } from "@/lib/fhe/encrypt";
import type { TxResult } from "@/lib/result";

// Largest value an euint64 can hold (FHEVM encrypted 64-bit unsigned integer).
export const MAX_UINT64 = 2n ** 64n - 1n;

// Hard cap on the on-chain description, to keep create transactions cheap.
export const MAX_DESCRIPTION_LENGTH = 280;

export type BallotActionContext = {
  publicClient: PublicClient;
  walletClient: WalletClient<Transport, Chain, Account>;
  getInstance: () => Promise<FhevmInstance>;
  ballotAddress: Address;
};

/// Sends one prepared transaction and waits for its receipt, mapping every
/// failure (wallet rejection, named revert, transport) to a distinct message.
/// `sendTransaction` simulates first so contract reverts (AlreadyVoted,
/// VotingPeriodOver, ...) surface before the wallet ever opens.
export async function submitTransaction(
  publicClient: PublicClient,
  failurePrefix: string,
  sendTransaction: () => Promise<Hex>,
): Promise<TxResult> {
  try {
    const txHash = await sendTransaction();
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      return { ok: false, reason: `${failurePrefix}: the transaction reverted on-chain (${txHash}).` };
    }
    return { ok: true, txHash };
  } catch (caught) {
    return { ok: false, reason: describeTransactionError(caught, failurePrefix) };
  }
}

export async function createBallot(
  context: BallotActionContext,
  params: { description: string; durationSeconds: bigint; beneficiary: Address; payoutAmount: bigint },
): Promise<TxResult> {
  const description = params.description.trim();
  if (description.length === 0) return { ok: false, reason: "The ballot needs a description." };
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return { ok: false, reason: `The description is limited to ${MAX_DESCRIPTION_LENGTH} characters.` };
  }
  if (params.durationSeconds <= 0n) return { ok: false, reason: "The voting duration must be positive." };
  if (params.payoutAmount <= 0n) return { ok: false, reason: "The payout amount must be positive." };
  if (params.payoutAmount > MAX_UINT64) {
    return { ok: false, reason: "The payout amount exceeds what an encrypted 64-bit value can hold." };
  }

  const encrypted = await encryptExternalInput(
    context.getInstance,
    context.ballotAddress,
    context.walletClient.account.address,
    (input) => input.add64(params.payoutAmount),
  );
  if (!encrypted.ok) return encrypted;

  return submitTransaction(context.publicClient, "Creating the ballot failed", async () => {
    const { request } = await context.publicClient.simulateContract({
      address: context.ballotAddress,
      abi: ConfidentialBallotAbi,
      functionName: "createBallot",
      args: [description, params.durationSeconds, params.beneficiary, encrypted.value.handle, encrypted.value.inputProof],
      account: context.walletClient.account,
    });
    return context.walletClient.writeContract(request);
  });
}

export async function castVote(
  context: BallotActionContext,
  params: { ballotId: bigint; support: boolean },
): Promise<TxResult> {
  const encrypted = await encryptExternalInput(
    context.getInstance,
    context.ballotAddress,
    context.walletClient.account.address,
    (input) => input.addBool(params.support),
  );
  if (!encrypted.ok) return encrypted;

  return submitTransaction(context.publicClient, "Casting the vote failed", async () => {
    const { request } = await context.publicClient.simulateContract({
      address: context.ballotAddress,
      abi: ConfidentialBallotAbi,
      functionName: "vote",
      args: [params.ballotId, encrypted.value.handle, encrypted.value.inputProof],
      account: context.walletClient.account,
    });
    return context.walletClient.writeContract(request);
  });
}

export async function closeBallot(context: BallotActionContext, params: { ballotId: bigint }): Promise<TxResult> {
  return submitTransaction(context.publicClient, "Closing the ballot failed", async () => {
    const { request } = await context.publicClient.simulateContract({
      address: context.ballotAddress,
      abi: ConfidentialBallotAbi,
      functionName: "closeBallot",
      args: [params.ballotId],
      account: context.walletClient.account,
    });
    return context.walletClient.writeContract(request);
  });
}

/// Fetches the two encrypted tally handles, has the relayer publicly decrypt
/// them, and posts the KMS-signed cleartexts back through resolve(). The
/// contract re-checks the signatures, so a tampered result cannot land.
export async function resolveBallot(context: BallotActionContext, params: { ballotId: bigint }): Promise<TxResult> {
  let tallies: readonly [Hex, Hex];
  try {
    tallies = await context.publicClient.readContract({
      address: context.ballotAddress,
      abi: ConfidentialBallotAbi,
      functionName: "getEncryptedTallies",
      args: [params.ballotId],
    });
  } catch (caught) {
    return { ok: false, reason: describeTransactionError(caught, "Reading the encrypted tallies failed") };
  }

  let instance: FhevmInstance;
  try {
    instance = await context.getInstance();
  } catch (caught) {
    return { ok: false, reason: describeUnknownError(caught, "The FHE client failed to initialize") };
  }

  // resolve() abi.decodes the cleartexts as (yes, no): keep this handle order.
  let cleartexts: Hex;
  let decryptionProof: Hex;
  try {
    const decrypted = await instance.publicDecrypt([tallies[0], tallies[1]]);
    cleartexts = decrypted.abiEncodedClearValues;
    decryptionProof = decrypted.decryptionProof;
  } catch (caught) {
    return { ok: false, reason: describeUnknownError(caught, "Public decryption of the tallies failed") };
  }

  return submitTransaction(context.publicClient, "Resolving the ballot failed", async () => {
    const { request } = await context.publicClient.simulateContract({
      address: context.ballotAddress,
      abi: ConfidentialBallotAbi,
      functionName: "resolve",
      args: [params.ballotId, cleartexts, decryptionProof],
      account: context.walletClient.account,
    });
    return context.walletClient.writeContract(request);
  });
}

export async function executePayout(context: BallotActionContext, params: { ballotId: bigint }): Promise<TxResult> {
  return submitTransaction(context.publicClient, "Executing the payout failed", async () => {
    const { request } = await context.publicClient.simulateContract({
      address: context.ballotAddress,
      abi: ConfidentialBallotAbi,
      functionName: "execute",
      args: [params.ballotId],
      account: context.walletClient.account,
    });
    return context.walletClient.writeContract(request);
  });
}
