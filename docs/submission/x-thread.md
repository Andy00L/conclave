# X thread draft (submission requirement: a thread or article presenting the project)

Post from your own account. Attach: the hero screenshot on tweet 1, the
resolved-ballot screenshot on tweet 3, the beneficiary balance screenshot on
tweet 4. Replace LIVE_URL with the deployed app URL before posting.

---

Tweet 1

On-chain votes are public. That means whale-watching, vote buying, and voting
against a proposal with your name attached.

Conclave runs DAO ballots where every vote is encrypted end to end, and only
the outcome is ever revealed. Built on @zama_fhe FHEVM, live on Sepolia.

Tweet 2

How it works: your choice is encrypted in the browser. The contract adds an
encrypted 1 to one of two sealed tallies with FHE.select, so there is no
running count to read, ever. On Etherscan a vote is just a handle and a proof.

Tweet 3

When voting ends, the tallies (and nothing else) are threshold-decrypted by
Zama's KMS. The contract checks the KMS signatures on-chain before trusting
the result. Aggregate revealed, individual votes sealed forever.

Tweet 4

The part that makes treasurers smile: each ballot carries an encrypted payout.
If it passes, the beneficiary is paid in ERC-7984 confidential tokens. The
amount never appears in clear. They decrypt their own balance with one EIP-712
signature.

Tweet 5

Private votes, public outcomes, confidential money.

Try it on Sepolia: LIVE_URL
Contracts + code: https://github.com/Andy00L/conclave

Built for the Zama Developer Program Season 3 Builder Track.
