# Conclave

Confidential on-chain governance on Ethereum, built with FHEVM. Ballots are cast fully encrypted: neither the choice nor (in the token-weighted mode) the weight is ever public. Only the aggregate result is decrypted at close. When a proposal passes, the contract releases a confidential payout from its treasury, so nothing leaks in clear from vote to execution.

Submission for the Zama Developer Program Mainnet Season 3, Builder Track.

## Why it matters

Public on-chain voting exposes who voted for what, which enables whale watching, vote buying, and voter coercion. Encrypting the ballot removes the signal while keeping the outcome verifiable by anyone.

## Repository layout

- `contracts/`: FHEVM smart contracts (Solidity, `@fhevm/solidity`), Hardhat, tests, deploy scripts.
- `web/`: frontend (Next.js App Router, Bun, wagmi + viem, `@zama-fhe/relayer-sdk`).

## Networks

Ethereum Sepolia (testnet), deployed 2026-07-03:

| Contract | Address |
| --- | --- |
| ConfidentialBallot | [`0xb9e89A9819d740C723a448BF7D3513D13b7e4F53`](https://sepolia.etherscan.io/address/0xb9e89A9819d740C723a448BF7D3513D13b7e4F53) |
| ConfidentialGovToken (cGOV) | [`0x62D93Eac4719F33DAab75f6B8E1aE4DDdd96223c`](https://sepolia.etherscan.io/address/0x62D93Eac4719F33DAab75f6B8E1aE4DDdd96223c) |

The frontend reads these through `NEXT_PUBLIC_BALLOT_ADDRESS` and `NEXT_PUBLIC_GOV_TOKEN_ADDRESS` (see `web/.env.example`).

## Run it

```bash
# contracts: compile and test (FHEVM mock)
cd contracts && bun install && bun run test

# frontend: needs web/.env.local with the two addresses above
cd web && bun install && bun run dev
```

## Status

Contracts deployed on Sepolia; ballot lifecycle (create, encrypted vote, close, reveal, confidential payout) working end to end in the web app.
