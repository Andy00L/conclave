# Conclave demo video script (3:00 max, pitched on camera or voice-over by a real person)

Rules from the track brief: a real person pitches (no AI voice or avatar), 3 minutes
maximum. Record the screen at 1280 px or wider, wallet connected to Sepolia,
app open on the dashboard with the staged ballots visible.

Preparation before recording:

- Treasury funded, three staged ballots visible: the open grant-round ballot on
  top, the passed-and-paid audit ballot, the rejected buyback ballot.
- Wallet holds Sepolia ETH; a second browser profile or wallet account ready to
  show the beneficiary decrypting their balance.
- One Etherscan tab open on the ConfidentialBallot contract, one on a vote
  transaction, to show what an observer sees: handles, not values.

## 0:00 to 0:25, the problem (face to camera if possible)

"On-chain governance has a privacy problem. Every vote is public, so whales get
watched and copied, votes can be bought because the buyer can verify them, and
anyone voting against a proposal does it in the open. Conclave fixes this with
Zama's FHEVM: votes are encrypted end to end, the chain tallies them without
ever seeing them, and only the final outcome is revealed."

## 0:25 to 0:55, cast an encrypted vote

Screen: the open grant-round ballot. Click "Vote yes".

"I am voting on a live ballot on Sepolia. The choice is encrypted in my browser
before it goes anywhere; the contract receives a ciphertext and a proof, and
adds an encrypted one to exactly one of two sealed tallies. Watch the ballot
card: it confirms my vote is in, but there is no count to show, because the
count itself is encrypted."

Switch briefly to the Etherscan tab on the vote transaction.

"This is what everyone else sees: a transaction with an encrypted handle. No
choice, no running tally, nothing to front-run or retaliate against."

## 0:55 to 1:40, reveal only the outcome

Screen: the audit ballot (already resolved) and the buyback ballot.

"When the voting window ends, anyone can close the ballot. That marks the two
tallies publicly decryptable, Zama's key-management network threshold-decrypts
them, and the contract verifies the KMS signatures on-chain before accepting
the result. Here is one that passed, two to one, and one that was rejected.
The bar shows the aggregate; the individual votes stay encrypted forever."

## 1:40 to 2:25, the confidential payout

Screen: the passed audit ballot, "Confidential payout sent" state, then the
treasury card in the beneficiary's browser profile.

"This is the part I like most. Each ballot carries a beneficiary and a payout
amount that was encrypted at creation. When the audit ballot passed, the
contract paid the beneficiary from its treasury with an ERC-7984 confidential
transfer. The amount never appeared in clear on-chain. As the beneficiary, I
sign one EIP-712 message and decrypt my own balance: 500 cGOV. Nobody else can
read it."

## 2:25 to 3:00, close

Screen: back to the dashboard.

"Everything you saw is live on Sepolia: encrypted ballots, KMS-verified
reveals, and confidential treasury payouts, end to end. The contracts and the
app are open source, and the README has the addresses so you can vote on the
grant-round ballot yourself. Private votes, public outcomes, confidential
money: that is Conclave."

## Shot checklist

- [ ] Vote cast on camera with the "Encrypting vote..." state visible
- [ ] Etherscan view of a vote transaction (handles only)
- [ ] Resolved ballot with the yes/no bar (passed) and one rejected
- [ ] Payout state plus beneficiary decrypting 500 cGOV
- [ ] Under 3:00 total
