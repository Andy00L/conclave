import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";

/// Turns a caught viem error into a short, distinct message. Wallet rejection,
/// a named contract revert, and transport failures must all read differently
/// so the user knows whether to retry, fix input, or check the network.
export function describeTransactionError(caught: unknown, prefix: string): string {
  if (caught instanceof BaseError) {
    const rejection = caught.walk((error) => error instanceof UserRejectedRequestError);
    if (rejection) return "Transaction rejected in the wallet.";
    const revert = caught.walk((error) => error instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName) {
      return `${prefix}: the contract reverted with ${revert.data.errorName}.`;
    }
    return `${prefix}: ${caught.shortMessage}`;
  }
  return describeUnknownError(caught, prefix);
}

export function describeUnknownError(caught: unknown, prefix: string): string {
  if (caught instanceof Error && caught.message.length > 0) return `${prefix}: ${caught.message}`;
  return `${prefix}: unknown error.`;
}
