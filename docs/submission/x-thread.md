# X thread (submission requirement: a thread presenting the project)

Post from your own account. Short lines on purpose: one idea per line, a blank
line between ideas. Read each tweet out loud once; if a line sounds like a
press release, cut it. Images to attach are listed under each tweet; capture
them from the live app at conclave-alpha.vercel.app (wallet connected, Sepolia).

---

Tweet 1

Attach: hero screenshot of the dashboard (docs/screenshots/01-dashboard.png or
a fresh capture).

your DAO vote is public.

anyone can watch it. anyone can buy it. anyone can hold it against you.

so I built Conclave: DAO ballots where every vote is encrypted end to end,
and the chain counts them without ever reading them.

live on Sepolia. thread:

---

Tweet 2

Attach: short screen recording of clicking "Vote yes" with the
"Encrypting vote..." state visible (10 to 15 seconds).

how voting works:

your choice is encrypted in the browser. before it goes anywhere.

the contract gets a ciphertext and a proof, and adds an encrypted +1 to one
of two sealed tallies.

on Etherscan your vote is a handle. no choice. no running count. nothing to
front-run.

---

Tweet 3

Attach: screenshot of a resolved ballot, tally bar and seal stamp visible.

when voting ends, only the two totals get decrypted.

Zama's key management network does the threshold decryption. the contract
checks the KMS signatures on-chain before trusting a single number.

the outcome: public.
your vote: sealed forever.

---

Tweet 4

Attach: screenshot of the treasury card showing the decrypted balance
(500 cGOV).

my favorite part is the money.

every ballot carries a payout amount, encrypted at creation.

if the ballot passes, the beneficiary gets paid in confidential ERC-7984
tokens. the amount never appears in clear.

they sign one message and decrypt their own balance. nobody else can.

---

Tweet 5

No image; let the links preview.

private votes. public outcomes. confidential money.

try it, there's an open ballot you can vote on right now:
https://conclave-alpha.vercel.app

code and contracts:
https://github.com/Andy00L/conclave

built on @zama_fhe FHEVM for the Developer Program, Mainnet Season 3.
