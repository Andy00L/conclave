import { toHex, type Address, type Hex } from "viem";
import type { FhevmInstance, RelayerEncryptedInput } from "@zama-fhe/relayer-sdk/web";
import { describeUnknownError } from "@/lib/errors";
import type { Failure } from "@/lib/result";

// Handle plus proof, as the contracts expect them (externalE* + inputProof).
export type EncryptedArgument = { handle: Hex; inputProof: Hex };

export type EncryptResult = { ok: true; value: EncryptedArgument } | Failure;

/// Encrypts one value for `contractAddress` through the Zama relayer.
/// `addValue` picks the encrypted type (addBool, add64, ...) so every caller
/// shares the same init and error handling instead of duplicating it.
export async function encryptExternalInput(
  getInstance: () => Promise<FhevmInstance>,
  contractAddress: Address,
  userAddress: Address,
  addValue: (input: RelayerEncryptedInput) => RelayerEncryptedInput,
): Promise<EncryptResult> {
  let instance: FhevmInstance;
  try {
    instance = await getInstance();
  } catch (caught) {
    return { ok: false, reason: describeUnknownError(caught, "The FHE client failed to initialize") };
  }

  try {
    const encrypted = await addValue(instance.createEncryptedInput(contractAddress, userAddress)).encrypt();
    const handle = encrypted.handles[0];
    if (!handle) return { ok: false, reason: "Encryption returned no handle." };
    return { ok: true, value: { handle: toHex(handle), inputProof: toHex(encrypted.inputProof) } };
  } catch (caught) {
    return { ok: false, reason: describeUnknownError(caught, "Encrypting the input via the Zama relayer failed") };
  }
}
