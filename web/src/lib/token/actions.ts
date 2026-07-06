import { zeroHash, type Account, type Address, type Chain, type Hex, type PublicClient, type Transport, type WalletClient } from "viem";
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";
import { ConfidentialGovTokenAbi } from "@/lib/abi/ConfidentialGovToken";
import { describeTransactionError, describeUnknownError } from "@/lib/errors";
import { submitTransaction } from "@/lib/ballots/actions";
import type { Failure, TxResult } from "@/lib/result";

export type TokenActionContext = {
  publicClient: PublicClient;
  walletClient: WalletClient<Transport, Chain, Account>;
  getInstance: () => Promise<FhevmInstance>;
  tokenAddress: Address;
};

// The user-decryption authorization the wallet signs stays valid this long.
// One day is enough for a session and keeps the granted window small.
const USER_DECRYPT_VALIDITY_DAYS = 1;

/// Claims the fixed test-token amount from the public faucet, once per address.
/// A second claim reverts on-chain (FaucetAlreadyClaimed); mint proper is
/// owner-only, see ConfidentialGovToken.sol.
export async function claimFaucet(context: TokenActionContext): Promise<TxResult> {
  return submitTransaction(context.publicClient, "Minting test tokens failed", async () => {
    const { request } = await context.publicClient.simulateContract({
      address: context.tokenAddress,
      abi: ConfidentialGovTokenAbi,
      functionName: "faucetMint",
      account: context.walletClient.account,
    });
    return context.walletClient.writeContract(request);
  });
}

export type BalanceResult = { ok: true; balance: bigint } | Failure;

/// Decrypts the caller's own confidential balance. The wallet signs an
/// EIP-712 authorization; the relayer then re-encrypts the balance to a
/// throwaway keypair so only this browser session can read the cleartext.
export async function decryptOwnBalance(context: TokenActionContext): Promise<BalanceResult> {
  const owner = context.walletClient.account.address;

  let balanceHandle: Hex;
  try {
    balanceHandle = await context.publicClient.readContract({
      address: context.tokenAddress,
      abi: ConfidentialGovTokenAbi,
      functionName: "confidentialBalanceOf",
      args: [owner],
    });
  } catch (caught) {
    return { ok: false, reason: describeTransactionError(caught, "Reading the balance handle failed") };
  }

  // An account that never received tokens has no ciphertext yet: balance is zero.
  if (balanceHandle === zeroHash) return { ok: true, balance: 0n };

  let instance: FhevmInstance;
  try {
    instance = await context.getInstance();
  } catch (caught) {
    return { ok: false, reason: describeUnknownError(caught, "The FHE client failed to initialize") };
  }

  try {
    const keypair = instance.generateKeypair();
    const startTimestamp = Math.floor(Date.now() / 1000);
    const eip712 = instance.createEIP712(
      keypair.publicKey,
      [context.tokenAddress],
      startTimestamp,
      USER_DECRYPT_VALIDITY_DAYS,
    );
    // The SDK emits startTimestamp and durationDays as decimal strings while
    // the typed data declares them uint256, so viem wants bigint values.
    const signature = await context.walletClient.signTypedData({
      domain: eip712.domain,
      types: eip712.types,
      primaryType: eip712.primaryType,
      message: {
        publicKey: eip712.message.publicKey,
        contractAddresses: eip712.message.contractAddresses,
        startTimestamp: BigInt(eip712.message.startTimestamp),
        durationDays: BigInt(eip712.message.durationDays),
        extraData: eip712.message.extraData,
      },
    });

    // The relayer expects the signature without its 0x prefix.
    // sourceRef: docs.zama.org, relayer SDK user decryption guide.
    const results = await instance.userDecrypt(
      [{ handle: balanceHandle, contractAddress: context.tokenAddress }],
      keypair.privateKey,
      keypair.publicKey,
      signature.replace(/^0x/, ""),
      [context.tokenAddress],
      owner,
      startTimestamp,
      USER_DECRYPT_VALIDITY_DAYS,
    );
    const clearValue = results[balanceHandle];
    if (typeof clearValue !== "bigint") {
      return { ok: false, reason: "The relayer returned no cleartext for the balance handle." };
    }
    return { ok: true, balance: clearValue };
  } catch (caught) {
    return { ok: false, reason: describeUnknownError(caught, "Decrypting the balance failed") };
  }
}
