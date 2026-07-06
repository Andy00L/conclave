import type { Account, Address, Chain, Hex, PublicClient, Transport, WalletClient } from "viem";
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";
import { ConfidentialBallotAbi } from "@/lib/abi/ConfidentialBallot";
import { ConfidentialGovTokenAbi } from "@/lib/abi/ConfidentialGovToken";
import { GOV_TOKEN_ADDRESS } from "@/lib/addresses";
import { describeTransactionError, describeUnknownError } from "@/lib/errors";
import { encryptExternalInput, encryptExternalInputs } from "@/lib/fhe/encrypt";
import type { Failure, TxResult } from "@/lib/result";

// Largest value an euint64 can hold (FHEVM encrypted 64-bit unsigned integer).
export const MAX_UINT64 = 2n ** 64n - 1n;

// Hard cap on the on-chain description, to keep create transactions cheap.
export const MAX_DESCRIPTION_LENGTH = 280;

// Operator authorization expiry given to the ballot on the token, a far-future
// uint48 timestamp (2100-01-01) as seconds. viem types uint48 as a number. One
// authorization covers voting and funding.
const OPERATOR_UNTIL = 4102444800;

export type BallotActionContext = {
  publicClient: PublicClient;
  walletClient: WalletClient<Transport, Chain, Account>;
  getInstance: () => Promise<FhevmInstance>;
  ballotAddress: Address;
};

/// Makes sure the ballot can pull the caller's tokens: if it is not already an
/// operator on the governance token, sends one setOperator transaction. Voting
/// and funding both move tokens through the ballot, so both need this.
async function ensureBallotOperator(context: BallotActionContext): Promise<{ ok: true } | Failure> {
  if (!GOV_TOKEN_ADDRESS) return { ok: false, reason: "The governance token is not configured." };
  // Local so the narrowing survives into the nested simulate closure below.
  const tokenAddress = GOV_TOKEN_ADDRESS;
  const voter = context.walletClient.account.address;

  let alreadyOperator: boolean;
  try {
    alreadyOperator = await context.publicClient.readContract({
      address: tokenAddress,
      abi: ConfidentialGovTokenAbi,
      functionName: "isOperator",
      args: [voter, context.ballotAddress],
    });
  } catch (caught) {
    return { ok: false, reason: describeTransactionError(caught, "Reading the token operator status failed") };
  }
  if (alreadyOperator) return { ok: true };

  const result = await submitTransaction(context.publicClient, "Authorizing the ballot on the token failed", async () => {
    const { request } = await context.publicClient.simulateContract({
      address: tokenAddress,
      abi: ConfidentialGovTokenAbi,
      functionName: "setOperator",
      args: [context.ballotAddress, OPERATOR_UNTIL],
      account: context.walletClient.account,
    });
    return context.walletClient.writeContract(request);
  });
  return result.ok ? { ok: true } : result;
}

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

/// Casts a stake-weighted vote: `weight` governance tokens are locked in the
/// ballot and count toward the chosen side. Authorizes the ballot as a token
/// operator first when needed, then submits the encrypted choice and weight.
export async function castVote(
  context: BallotActionContext,
  params: { ballotId: bigint; support: boolean; weight: bigint },
): Promise<TxResult> {
  if (params.weight <= 0n) return { ok: false, reason: "Enter a stake above zero to vote." };
  if (params.weight > MAX_UINT64) {
    return { ok: false, reason: "The stake exceeds what an encrypted 64-bit value can hold." };
  }

  const authorized = await ensureBallotOperator(context);
  if (!authorized.ok) return authorized;

  const encrypted = await encryptExternalInputs(
    context.getInstance,
    context.ballotAddress,
    context.walletClient.account.address,
    (input) => input.addBool(params.support).add64(params.weight),
  );
  if (!encrypted.ok) return encrypted;
  const [supportHandle, weightHandle] = encrypted.value.handles;
  if (!supportHandle || !weightHandle) return { ok: false, reason: "Encryption returned too few handles." };

  return submitTransaction(context.publicClient, "Casting the vote failed", async () => {
    const { request } = await context.publicClient.simulateContract({
      address: context.ballotAddress,
      abi: ConfidentialBallotAbi,
      functionName: "vote",
      args: [params.ballotId, supportHandle, weightHandle, encrypted.value.inputProof],
      account: context.walletClient.account,
    });
    return context.walletClient.writeContract(request);
  });
}

/// Reclaims the stake a voter locked on a ballot, once it has resolved.
export async function withdrawStake(context: BallotActionContext, params: { ballotId: bigint }): Promise<TxResult> {
  return submitTransaction(context.publicClient, "Withdrawing the stake failed", async () => {
    const { request } = await context.publicClient.simulateContract({
      address: context.ballotAddress,
      abi: ConfidentialBallotAbi,
      functionName: "withdraw",
      args: [params.ballotId],
      account: context.walletClient.account,
    });
    return context.walletClient.writeContract(request);
  });
}

/// Funds the ballot treasury with an encrypted amount of the governance token.
/// The amount is tracked apart from voter stakes, so it can only pay beneficiaries.
export async function fundTreasury(context: BallotActionContext, params: { amount: bigint }): Promise<TxResult> {
  if (params.amount <= 0n) return { ok: false, reason: "The funding amount must be positive." };
  if (params.amount > MAX_UINT64) {
    return { ok: false, reason: "The amount exceeds what an encrypted 64-bit value can hold." };
  }

  const authorized = await ensureBallotOperator(context);
  if (!authorized.ok) return authorized;

  const encrypted = await encryptExternalInput(
    context.getInstance,
    context.ballotAddress,
    context.walletClient.account.address,
    (input) => input.add64(params.amount),
  );
  if (!encrypted.ok) return encrypted;

  return submitTransaction(context.publicClient, "Funding the treasury failed", async () => {
    const { request } = await context.publicClient.simulateContract({
      address: context.ballotAddress,
      abi: ConfidentialBallotAbi,
      functionName: "fundTreasury",
      args: [encrypted.value.handle, encrypted.value.inputProof],
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
