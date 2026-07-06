# Conclave demo video script

Target cut: 0:00 to 0:15 intro animation, then about 2:00 of you talking over
the screen. Total around 2:15, comfortably under the 3:00 cap. The track brief
requires a real person pitching (no AI voice, no avatar), so record your own
voice and speak like you would to a friend; the SAY blocks below are written
the way people actually talk. Read them out loud twice before recording, then
say them from memory. If you drift from the exact words, good: keep your own
phrasing, keep the beats.

## Recording setup (do this before pressing record)

- Open `docs/submission/intro-animation.html` full screen in the browser
  (press F11). You will record it as the first 15 seconds: start recording,
  press Space, let it play to the end card.
- App open on https://conclave-alpha.vercel.app, wallet connected, Sepolia,
  1280 px wide or more. The staged ballots visible: the open grant-round
  ballot on top, the passed audit ballot, the rejected one.
- Wallet holds Sepolia ETH (the Test tokens card in the app covers this).
- A second browser profile with the beneficiary account, ready on the
  treasury card, balance still sealed.
- One Etherscan tab open on a vote transaction from the ConfidentialBallot
  contract.
- Hide bookmarks bar, close extra tabs, mute notifications.

---

## 0:00 to 0:15, intro animation

DO: play the recorded intro animation. No talking, or start talking over its
last two seconds if the silence feels long.

## 0:15 to 0:35, who I am and what this is

DO: dashboard visible, cursor still.

SAY: "Hey, so this is my submission for the Zama Developer Program, Season 3,
Builder track. It's called Conclave, and basically it's DAO voting where
nobody can see your vote. Not the other voters, not the whales watching the
chain, not even the contract itself. And everything I'm about to show you is
live on Sepolia right now."

## 0:35 to 1:05, cast an encrypted vote

DO: scroll to the open grant-round ballot. Click "Vote yes", let the
"Encrypting vote..." state show, confirm in MetaMask, wait for the card to
confirm the vote is in.

SAY: "So let me just vote on this open ballot. I pick yes... and before
anything leaves my browser, my choice gets encrypted. The contract receives a
ciphertext and a proof, and it adds an encrypted one to one of two sealed
counters. And look at the card: it knows my vote is in, but there's no count
anywhere. That's not a UI choice, the count itself is encrypted."

DO: switch to the Etherscan tab on a vote transaction, hover the input data.

SAY: "This is the same kind of vote on Etherscan. It's just a handle. No
choice, no running tally, nothing to copy, nothing to retaliate against."

## 1:05 to 1:35, reveal only the outcome

DO: back to the app, scroll to the resolved ballots. Let the tally bars and
the seal stamps play; pause on the passed one, then the rejected one.

SAY: "When the voting window ends, anyone can close the ballot. Zama's key
management network decrypts just the two totals, and the contract verifies
their signatures on-chain before it accepts a single number. So here's one
that passed, two to one. Here's one that got rejected. You get the outcome,
and the individual votes stay sealed forever."

## 1:35 to 2:05, the confidential payout

DO: point at the passed ballot's "Confidential payout sent" line. Then switch
to the beneficiary profile, treasury card, click "Decrypt", sign the message,
let the balance appear.

SAY: "And this is my favorite part. Every ballot carries a payout amount that
was encrypted when the ballot was created. This one passed, so the contract
paid the beneficiary from its treasury, and the amount never appeared in
clear on-chain. Now, if I'm the beneficiary, I sign one message... and I can
decrypt my own balance. Five hundred cGOV. Nobody else can read that number."

## 2:05 to 2:15, close

DO: back to the dashboard, hero visible, cursor still.

SAY: "So that's Conclave. Private votes, public outcomes, confidential money.
It's all open source, links are below, and there's an open ballot on Sepolia
right now if you want to cast an encrypted vote yourself. Thanks for
watching."

---

## Shot checklist

- [ ] Intro animation plays clean, no cursor, no hint text in frame
- [ ] Vote cast on camera with the "Encrypting vote..." state visible
- [ ] Etherscan view of a vote transaction (handles only)
- [ ] One passed bar (2 to 1) and one rejected, seal stamps visible
- [ ] Beneficiary decrypts 500 cGOV on camera
- [ ] Total under 3:00 (target 2:15)
