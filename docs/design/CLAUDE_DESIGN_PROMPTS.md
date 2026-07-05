# Conclave prompt pack for Claude Design (v2, paper and seal)

The generate-and-integrate loop contract. The session compiled this pack from
the real token sheet (docs/UI_DESIGN_SYSTEM.md v2); the human runs the
prompts in Claude Design with the listed attachments; the session integrates
the returned code and gates it. Regenerations always resend the system
prompt. v2 replaces the dark v1 pack: the direction is now a warm light
editorial system (Wealthsimple discipline, conclave domain).

---

## 0. How to run this pack (the human's sequence)

1. Open Claude Design. ONE conversation for the whole design.
2. First message: attach `palette-card.png` and `icon.svg`, then paste the
   system prompt (section 1) followed by screen prompt 1 (section 2) in the
   same message. Generate.
3. Iterate on screen 1 only: ask for another take ("same tokens, different
   composition"), 3 to 5 variants total, ONE change per regeneration
   ("same screen, larger hero", never three changes at once). If colors
   drift, re-attach palette-card.png and say "match the attached palette
   exactly".
4. When a variant wins, reply "lock this style, we build the next screens
   on it" and note the variant.
5. Same conversation: paste the system prompt again + screen prompt 2.
   Iterate the same way. Then system prompt + screen prompt 3.
6. Export the code of every accepted screen (copy the TSX) into
   `conclave/.design-drop/`: `01-dashboard.tsx`, `02-ballot-card.tsx`,
   `03-panels.tsx`, plus a short note of which variant won and anything to
   keep at all costs. The folder is gitignored.
7. Hand the drop back to the session. The session then integrates:
   re-tokenize, wire real Sepolia data and actions, add missing states,
   accessibility, motion, and the gate.
8. Recovery: if the conversation drifts or fills up, start a new one,
   re-paste the system prompt, attach a screenshot of the accepted screen 1,
   and say "match the attached screen exactly".

## 1. The system prompt (paste with EVERY screen prompt)

```
You are designing Conclave, a confidential DAO governance dApp on Ethereum.
Votes are encrypted end to end, only the aggregate outcome is revealed, and
a passing ballot pays its beneficiary a confidential amount from a treasury.
Register: calm trust, editorial, ceremonial. References for discipline,
never pixels: Wealthsimple (warm field, restraint), Apple (one held reveal),
Stripe (numbers treated beautifully). Single LIGHT theme. The mood in one
line: a ballot paper on a warm table, ink and one bronze seal; the only
drama is the reveal.

TOKENS (exact values; never invent others)
- Field #F4F1E9. Never flat, always this recipe:
  background:
    radial-gradient(1100px 500px at 50% -10%, rgba(154,91,19,0.06), transparent 60%),
    radial-gradient(130% 100% at 50% 50%, transparent 60%, rgba(28,25,23,0.045) 100%),
    #F4F1E9;
  plus a barely visible film grain overlay at 4% opacity.
- Card surface #FBFAF5. Recessed wells (inputs, chips, skeleton blocks)
  #EDE9DE with inset 0 1px 2px rgba(28,25,23,0.06).
- Hairlines: rgba(28,25,23,0.08); strong rgba(28,25,23,0.16).
- Text: ink #1C1917; muted #57534E; faint #736E64 (eyebrows, disabled;
  nothing lighter than this ever carries text).
- ONE accent: bronze #9A5B13 (deep #7A470E, wash rgba(154,91,19,0.08)).
  The only saturated color at rest: links, focus rings, active states, the
  seal, the "Voting" pill. Nothing else uses it.
- Reserved verdict colors, used ONLY on tallies, verdict pills, seals, and
  vote outcomes: yes #25704F (wash rgba(37,112,79,0.10)), no #A63D32 (wash
  rgba(166,61,50,0.10)). Errors reuse #A63D32.
- Type: Fraunces (serif) for the display and card titles, letter-spacing
  -0.02em, weight 500 to 600 max. Geist Sans for UI text (14 to 16px).
  Geist Mono for everything precise: addresses, amounts, counts, eyebrow
  labels (11px uppercase, tracking 0.14em, color faint). Numbers always
  tabular.
- Radii: 8px chips, 10px inputs, 18px cards, 999px buttons and pills.
  Spacing base 4px; card padding 24px; content max width 68rem.

THE MATERIAL (every panel, exactly this, never nested):
  background #FBFAF5; border 1px rgba(28,25,23,0.08); border-radius 18px;
  box-shadow: 0 1px 2px rgba(28,25,23,0.05),
              0 8px 24px -12px rgba(28,25,23,0.10),
              0 24px 48px -28px rgba(28,25,23,0.08);
  One light source from above; every shadow agrees with it.
  Interactive hover: border rgba(28,25,23,0.16), shadow one step deeper,
  translateY(-1px), 200ms.

BUTTONS
- Primary: an ink pill. Height 44px, radius 999px, background #1C1917,
  text #F7F5EF, weight 500;
  box-shadow 0 1px 2px rgba(28,25,23,0.20), 0 8px 20px -10px rgba(28,25,23,0.35);
  hover background #322D28 and translateY(-1px); press scale 0.98;
  disabled 40% opacity, no shadow.
- Quiet: transparent pill, 1px hairline border, ink text; hover fills with
  the well color #EDE9DE.
- Focus everywhere: a visible 2px ring rgba(154,91,19,0.7), offset 2px.

SIGNATURES (both mandatory, exact placement)
1. The wax seal: an SVG ring (1.5px stroke at 45% opacity) around a filled
   core circle. Bronze beside the wordmark "Conclave" in the header; green
   or red version stamped once beside the verdict line of each resolved
   ballot. Nowhere else.
2. The ciphertext chip: every sealed value renders as a mono chip: lock
   glyph (bronze) + label + three shade blocks (U+2592), 11px uppercase
   mono on a #EDE9DE well with a hairline border, radius 8px. Sealed data
   is never plain prose.

MOTION (implement it in the code, do not just imply it)
- Durations 100ms micro / 200ms standard / 300ms large / 500ms reserved
  for the tally reveal only. Exits run 20% shorter than enters.
- Easings: enter cubic-bezier(0.16,1,0.3,1); standard
  cubic-bezier(0.4,0,0.2,1); exit cubic-bezier(0.4,0,1,1). Never a default
  or linear easing.
- Page entrance: the hero block fade-rises 12px over 300ms; cards follow,
  each fade-rising 8px with a 50ms stagger. One thing moves at a time.
- The hero moment, the reveal on a resolved ballot: the tally bar grows
  (scaleX from 0, transform-origin left, 500ms, enter easing), the counts
  count up over 700ms decelerating, then the wax seal stamps in 200ms
  later (opacity + scale 1.12 to 1, the single allowed overshoot).
  Everything else stays quieter than this moment.
- Animate transform and opacity only. Respect prefers-reduced-motion:
  collapse everything to opacity with an identical final layout.

NEVER DO (hard rules)
- Never a second saturated accent, never electric blue, never a dark
  theme, never rainbow or fintech gradients.
- Never a flat single shadow, never pure #FFFFFF cards or field, never
  pure black.
- Never default easing, never scale-from-0 entrances, never animate
  layout properties, never two things moving at once, never a stagger of
  100ms or more.
- Never title case: sentence case everywhere except the mono eyebrows.
- Never lorem ipsum or fake round numbers: use the exact sample data
  given.
- Never invent features, nav items, footers, stats, charts, or toggles
  not listed in the screen prompt.
- Contrast floor 4.5:1 for all text; visible bronze focus ring on every
  interactive element; touch targets 44px minimum.

OUTPUT: React function components in TypeScript (TSX), styled with
Tailwind utility classes; read every color from CSS variables named
--color-paper, --color-card, --color-well, --color-line,
--color-line-strong, --color-ink, --color-muted, --color-faint,
--color-bronze, --color-bronze-deep, --color-yes, --color-no (assume they
exist). Icons from lucide-react only. No component library, no other
dependency.
```

## 2. Screen prompt 1: the dashboard (the hero screen, generate first)

```
Design the Conclave dashboard, the product's only page. Desktop 1440px
first; at under 1024px the two columns stack (ballots first, then the side
panels). Implement the page entrance choreography from the system prompt.

LAYOUT, top to bottom
- Sticky header on the paper field (paper at 80% opacity + backdrop blur,
  hairline bottom border): left = wax seal + "Conclave" in Fraunces 20px +
  mono eyebrow "confidential governance"; right = the wallet zone. Design
  BOTH header states: (a) disconnected: one primary pill "Connect wallet";
  (b) connected: a mono pill "0x20ac...4425" with a small green dot
  (Sepolia) + a quiet text button "Disconnect".
- Hero (max width 44rem, left aligned): bronze mono eyebrow "CONFIDENTIAL
  GOVERNANCE ON ETHEREUM"; Fraunces display 52px, two lines: "Vote in
  private." / "Reveal only the outcome."; one muted paragraph: "Every vote
  is encrypted before it leaves the browser and stays encrypted on-chain.
  At close, only the aggregate result is decrypted. A passing ballot pays
  its beneficiary a confidential amount from the treasury."; below it, a
  3-step pipeline rail: small framed round icon chips (lock "Vote
  encrypted", shield "Tally sealed", flame "Outcome revealed") joined by
  32px hairlines.
- When disconnected, one slim notice card (wallet icon): "Ballots are
  public below. Connect a wallet to vote, create ballots, and fund the
  treasury."
- Main grid: left 2/3 = a section row with Fraunces "Ballots" + mono count
  "5 on-chain", then the ballot list; right 1/3 = the "New ballot" form
  card above the "Treasury" card.

BALLOT LIST CONTENT (exact data, in this order)
Every card carries a meta row: mono eyebrow "BALLOT n" + middot +
"BENEFICIARY" + mono copy chip "0x15f8...0cef" + middot + ciphertext chip
"payout".
1. Open ballot: title "Fund the Q3 open-source grant round (250 cGOV)",
   bronze "Voting" pill (dot + label), "BALLOT 4", clock line "6 d left,
   closes 7/11/2026, 6:56 PM", actions: primary "Vote yes" + quiet
   "Vote no".
2. Resolved passed: title "Renew the contributor grants committee for Q3
   (750 cGOV)", green "Passed" pill, "BALLOT 2", the reveal: an 8px tally
   bar (green 66%, soft red rest), mono counts "2 yes" in green and "1 no"
   in red, then the green wax seal + "Confidential payout sent to the
   beneficiary."
3. Resolved rejected: title "Double the marketing budget for next quarter
   (2000 cGOV)", red "Rejected" pill, "BALLOT 3", bar green 33% / red 67%,
   counts "1 yes / 2 no", red seal + "Rejected. The treasury keeps its
   funds."

SIDE PANELS (part of this page; a later prompt details their states)
- "New ballot" card: Fraunces title, one muted sentence, mono eyebrow
  labels above fields: "QUESTION" textarea (placeholder "Fund the
  community grant?"), "VOTING WINDOW" select showing "1 day", "BENEFICIARY
  ADDRESS" mono input ("0x..."), "SEALED PAYOUT (CGOV)" mono input
  ("100"), full-width primary "Create ballot".
- "Treasury" card: lock icon + Fraunces "Treasury", two muted sentences,
  "AMOUNT (CGOV)" input with an inline primary "Fund" button, hairline
  divider, "YOUR BALANCE" row: ciphertext chip "balance" + quiet "Decrypt"
  button, helper caption "Decrypting asks the wallet for one EIP-712
  signature; the relayer re-encrypts the balance to a throwaway key only
  this page holds."

DO NOT invent: no charts, no stats row, no footer, no nav tabs, no
search, no theme toggle, no token logos, no testimonials.
```

## 3. Screen prompt 2: the ballot card, every state

```
Same product, same tokens. Design a component sheet on the paper field:
the Conclave ballot card in ALL of its states, laid out as a two-column
grid (desktop 1440px), each card under a small faint mono caption naming
the state. The card is the product's hero component: Fraunces title, state
pill top right, meta row (mono eyebrow "BALLOT n" + middot + "BENEFICIARY"
+ mono copy chip "0x15f8...0cef" + middot + ciphertext chip "payout"),
then the state-specific body and actions.

THE STATES (exact data)
1. Voting, open: "Fund the Q3 open-source grant round (250 cGOV)", bronze
   "Voting" pill, clock line "6 d left, closes 7/11/2026, 6:56 PM",
   actions primary "Vote yes" + quiet "Vote no".
2. Voting, already voted: same card, actions replaced by a confirmation
   line with a small green check: "Your encrypted vote is in."
3. Voting ended, not closed: muted line "Voting has ended. Close the
   ballot to seal the tallies for decryption.", primary action "Close
   voting". Under its action, one inline error example: "The wallet
   rejected the transaction." in #A63D32, 14px.
4. Sealed (awaiting reveal): neutral ink-wash pill "Sealed", muted line
   "Tallies are sealed. Reveal the result to bring the cleartext
   on-chain.", primary action "Reveal result".
5. Resolved, passed, payout sent: "Renew the contributor grants committee
   for Q3 (750 cGOV)", green "Passed" pill, the reveal block: 8px tally
   bar green 66% / red 34%, mono counts "2 yes" and "1 no", green wax seal
   + "Confidential payout sent to the beneficiary."
6. Resolved, passed, payout pending: same as 5 but the seal line reads
   "Passed. The confidential payout is ready to send." + primary action
   "Send confidential payout".
7. Resolved, rejected: "Double the marketing budget for next quarter
   (2000 cGOV)", red "Rejected" pill, bar green 33% / red 67%, counts
   "1 yes / 2 no", red seal + "Rejected. The treasury keeps its funds."
8. Loading skeleton: well-colored pulsing blocks mirroring the exact final
   layout (title line, pill, meta row, body line, two pill buttons); no
   spinner.
PLUS the empty state block, shown once: a framed vote icon in a well
circle, Fraunces "No ballots yet", one muted sentence "Create the first
ballot; voting stays encrypted end to end.", nothing else.

MOTION on this sheet: implement the reveal choreography on state 5 exactly
as the system prompt specifies (bar grows 500ms, counts count up 700ms,
seal stamps in 200ms later with the 1.12 to 1 overshoot).

DO NOT invent extra states, tooltips, dropdown menus, or percentages
beyond the counts given.
```

## 4. Screen prompt 3: the side panels and wallet zone, every state

```
Same product, same tokens. Design a component sheet on the paper field
(desktop 1440px, a grid with faint mono captions naming each variant):
the two side panels and the header wallet zone, in all their states.

NEW BALLOT FORM (card, 4 variants)
1. Default: Fraunces title "New ballot", muted sentence "The payout is
   encrypted before it leaves this page. If the ballot passes, the
   beneficiary receives that sealed amount from the treasury.", fields
   with mono eyebrow labels: "QUESTION" textarea (placeholder "Fund the
   community grant?"), "VOTING WINDOW" select ("10 minutes / 1 hour /
   1 day / 3 days / 7 days", showing "1 day"), "BENEFICIARY ADDRESS" mono
   input ("0x..."), "SEALED PAYOUT (CGOV)" mono input ("100"), full-width
   primary "Create ballot". Inputs sit on the well color with the inset
   shadow; one input is shown focused with the bronze ring.
2. Disconnected: the button disabled (40% opacity, no shadow) + helper
   "Connect a wallet to create a ballot." in 12px muted.
3. Inline error: filled fields, a red 14px line under the button: "The
   beneficiary is not a valid address."
4. Submitting: the button reads "Encrypting and creating..." with a small
   spinner, fields disabled.

TREASURY CARD (3 variants)
1. Sealed: lock icon + Fraunces "Treasury", sentences "The ballot
   contract holds confidential cGOV: its balance is a ciphertext
   on-chain. Fund it here, then let passing ballots spend it.", "AMOUNT
   (CGOV)" input + inline primary "Fund", hairline divider, "YOUR
   BALANCE" row: ciphertext chip "balance" + quiet "Decrypt" button,
   helper caption "Decrypting asks the wallet for one EIP-712 signature;
   the relayer re-encrypts the balance to a throwaway key only this page
   holds."
2. Decrypted: the balance row shows tabular mono ink "1250 cGOV" instead
   of the chip; the quiet "Decrypt" button unchanged.
3. Funding pending: the "Fund" button reads "Minting..." with a small
   spinner.

HEADER WALLET ZONE (3 variants, shown as slim standalone bars)
1. Disconnected: primary pill "Connect wallet".
2. Connected on Sepolia: mono pill "0x20ac...4425" with a small green dot
   + quiet text "Disconnect".
3. Wrong network: add a red-wash warning pill with a triangle icon:
   "Switch to Sepolia".

DO NOT invent: no balances in the header, no avatars, no network
dropdown, no gas estimates, no toasts.
```

## 5. Attachments (send both with every generation)

| File | What it pins |
| --- | --- |
| `docs/design/palette-card.png` | the v2 palette, type pairing, material, chip, tally, seal, buttons |
| `docs/assets/icon.svg` | the seal mark |

Do NOT attach the old dashboard screenshots: they show the retired dark
theme and would pull generations back to it.

## 6. Iteration guide (for the human)

1. Screen 1 first at desktop width; it locks the style for everything.
2. 3 to 5 variants per screen; pick one; note which won.
3. One variable per regeneration ("same screen, tighter ballot cards"),
   never three changes at once. Off-palette output: re-attach
   palette-card.png and say "match the attached palette exactly".
4. Export the winning TSX of each accepted screen into
   `conclave/.design-drop/` and return it with the variant notes. The
   session re-tokenizes, wires real data and states, and gates it;
   generated code is a draft, never merged as-is.

---

## 7. Intro animation (the 15-second product presentation)

A separate Claude Design conversation from the UI screens. One system prompt,
one piece prompt, generated together in the first message. Output is a
self-contained HTML file the human screen-records as the first 15 seconds of
the demo video. It is a fast, premium presentation of the REAL Conclave UI in
motion (a ballot card that votes, resolves, and pays) composed in THREE layers,
so the hero card never floats alone in an empty field. Attach `palette-card.png`
and `icon.svg`, plus `01-dashboard.png` for ambience. Watch it once through,
then tweak one variable at a time ("same piece, denser ciphertext field", "same
piece, slower push-in"). A rendered reference frame of the accepted take,
re-attached, locks the look if a regeneration drifts.

### 7.1 The system prompt (paste first)

```
You are building a 15-second animated product presentation that opens the
Conclave demo video: a fast, premium showcase of the real Conclave interface
in motion. Conclave is a confidential DAO governance dApp on Ethereum: votes
are encrypted end to end, only the aggregate outcome is revealed, and a passing
ballot pays its beneficiary a confidential amount from a treasury. Register:
calm trust, editorial, ceremonial, but energetic in pace. The bar, never copied
for pixels: Linear and Stripe product films (real UI in motion, kinetic labels,
crisp cuts), Wealthsimple (warm field, one bronze object, restraint). Single
LIGHT theme. In one line: the actual product moving with confidence, a living
warm workspace around it, one bronze seal, the only drama is the reveal.

COMPOSE THREE LAYERS (a card alone on an empty field is the failure mode)
The single most common miss is a hero card floating in a big void. Do not do
that. Stack three layers, back to front, and keep them all alive:
  1. AMBIENT (background and edges): the warm field, out-of-focus ghost ballot
     cards, a slow-drifting ciphertext field, and thin frame furniture at the
     corners and edges. This is what fills the "outer layer". It is always
     present, always subordinate: low opacity, blurred, slow.
  2. HERO (center): the one sharp, fully-lit ballot card. It is the only
     in-focus, high-contrast object on screen, so the eye locks to it.
  3. FINISHING (on top): grain, a feathered vignette, one specular sweep, depth
     of field. Dialed low, felt not seen.
Restraint rule stays absolute: the ambient layer must never compete with the
hero. If a background element is as sharp or as bright as the card, it is wrong.

WHAT THIS IS (read this twice)
- It shows the REAL Conclave UI: an actual ballot card, an actual vote sealing
  into a ciphertext chip, the actual tally bar revealing, the actual wax seal
  stamping the verdict, an actual balance flipping from sealed to clear. Build
  the product's own components and animate them. Short kinetic labels annotate
  each moment.
- Fast but premium: a new focal moment lands about every 1 to 1.5 seconds, one
  dominant motion at a time, a beat of stillness between moments.

OUTPUT
- A single self-contained HTML file: inline CSS and JS, one Google Fonts link
  allowed (Fraunces, Geist, Geist Mono). No framework, no build step, no
  external asset besides the fonts.
- A 1920x1080 (16:9) stage, centered, meant to be screen-recorded. It plays
  once on load and then holds the final card perfectly still. Pressing R
  restarts it. Honor prefers-reduced-motion: land straight on the held end
  card, same final composition, no motion (ambient drift, ticker, and sweeps
  all freeze).
- Animate transform and opacity only, hold 60fps. Every value below is a token;
  never invent a color, a duration, or an easing that is not listed.

TOKENS (exact)
- Field #F4F1E9, never flat:
    radial-gradient(1100px 500px at 50% -10%, rgba(154,91,19,0.06), transparent 60%),
    radial-gradient(130% 100% at 50% 50%, transparent 60%, rgba(28,25,23,0.045) 100%),
    #F4F1E9
- Card surface #FBFAF5. Recessed well (chips, the tally track) #EDE9DE with
  inset 0 1px 2px rgba(28,25,23,0.06). Hairline rgba(28,25,23,0.08); strong
  rgba(28,25,23,0.16).
- Ink #1C1917; ink-soft #322D28; muted #57534E; faint #736E64 (nothing lighter
  carries text).
- ONE accent: bronze #9A5B13 (deep #7A470E). The only saturated color at rest:
  the eyebrow, the lock glyphs, the "Voting" pill, the seal, the frame marks.
- Reserved verdict colors, used ONLY on the pill, the tally, and the seal: yes
  #25704F (wash rgba(37,112,79,0.10)), no #A63D32 and its wash
  rgba(166,61,50,0.4).
- Type: Fraunces (serif) for the card titles, the labels, and the wordmark
  (weight 550, letter-spacing -0.015em). Geist Mono for the eyebrow, the meta
  row, the chips, the counts, the frame furniture, the footnote (11 to 13px;
  uppercase where it is a label; tracking 0.14em to 0.18em). Numbers tabular.
- Radii: 8 to 10px chips, 18px cards, 999px pills. Card padding 24px.

THE MATERIAL (the hero card, exactly this, never nested)
  background #FBFAF5; border 1px rgba(28,25,23,0.08); border-radius 18px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.6),      /* a faint bright top edge */
              0 1px 2px rgba(28,25,23,0.05),
              0 8px 24px -12px rgba(28,25,23,0.10),
              0 24px 48px -28px rgba(28,25,23,0.08);
  One light from above; every shadow agrees with it. The hero card is fully
  sharp; ghost cards reuse this shape but blurred and dimmed.

THE PRODUCT COMPONENTS (the hero, real UI)
- Ballot card: Fraunces title, a state pill top right (bronze "Voting" with a
  small breathing dot, or green "Passed" with a still dot), a mono meta row
  ("BALLOT 4" + middot + "BENEFICIARY" + a mono chip "0x15f8...0cef" + middot +
  a ciphertext chip "payout"), then a single body slot (see ONE BODY SLOT).
- Ciphertext chip: a #EDE9DE well with a hairline, radius 8 to 10px, a bronze
  lock glyph + a label + three shade blocks (U+2592). Every sealed value is
  this chip, never plain text.
- Vote buttons: an ink pill "Vote yes" (background #1C1917, text #F7F5EF) and a
  quiet hairline pill "Vote no".
- Tally block: a 12px pill track (well bg), a green #25704F fill growing from
  the left, the losing side the no wash rgba(166,61,50,0.4), two mono tabular
  counts "2 yes" (green) and "1 no" (muted).
- Wax seal: an SVG ring (1.5px stroke at 45% opacity) around a filled core,
  bronze at rest, green when it stamps the passed verdict.

THE AMBIENT / OUTER LAYER (build every item; this is what the field was missing)
- Ghost ballot cards: 2 or 3 copies of the card silhouette placed off-center
  behind the hero (one upper-left, one lower-right, one far), heavily blurred
  (depth of field, blur 10 to 16px), low opacity (0.20 to 0.35), each drifting
  a few px on its own 14 to 20s loop at a different rate (parallax). They imply
  a whole ledger of ballots, not one lonely card. Never sharp, never readable.
- Ciphertext field: 14 to 22 small mono fragments scattered across the frame,
  mostly toward the edges, each a faint (opacity 0.05 to 0.10) truncated hex or
  shade-block token like "0x9af3", "(three blocks)", "euint64", a lock glyph.
  They drift very slowly on 16 to 24s loops with slight parallax and a 2 to 4px
  blur. The air itself is encrypted. Near-subliminal, never a focal point.
- Frame furniture (the small edge details): a 1px hairline inset frame about
  44px from each edge at 0.06 opacity; a thin bronze L-mark in each of the four
  corners (registration marks); top-left a faint mono eyebrow "CONCLAVE (middot)
  CONFIDENTIAL LEDGER"; bottom-left a faint mono "SEPOLIA"; bottom-right a live
  mono block ticker "BLOCK 8 42X XXX" whose last two digits odometer-roll up
  once about every 2s (a quiet sign of a live chain). All frame furniture sits
  at 0.25 to 0.4 opacity, never brighter than the muted ink.
- The bronze seal watermark: one very large faint ring (opacity about 0.05)
  centered behind the hero, breathing scale 1.03 to 1 across the whole piece; it
  resolves into the solid end-card seal.

DEPTH, LIGHT, AND FINISHING (apply last, dialed low, felt not seen)
- Depth of field: the ambient layer is blurred (ghost cards 10 to 16px, motes 2
  to 4px); the hero card and its labels are perfectly sharp. This separation is
  what reads as premium.
- One specular sweep: a single soft light band crosses the hero card once, at
  the reveal (about 8.6s), under 900ms, low opacity. Never twice.
- Film grain over everything at 4% opacity, hopped in steps (a small tiling
  noise translated frame to frame) so it reads as film, not a dirty screen.
- The warm grade and the feathered vignette are already in the field recipe. Do
  not add a visible edge or a nameable glow.

MOTION TOKENS
- Durations: 150ms micro, 240ms standard moves, 380 to 460ms the tally reveal,
  520ms the count-up; ambient loops 14 to 24s. Exits run about 20% shorter.
- Easings: enter cubic-bezier(0.16,1,0.3,1); standard cubic-bezier(0.4,0,0.2,1);
  exit cubic-bezier(0.4,0,1,1). Never a default or linear easing (linear only
  on the constant grain hop, the ambient drift, and the slow push-in).
- One stagger constant: 60ms. Overshoots, budgeted: the wax seal stamp (scale
  1.12 to 1) and the button press (scale 0.97), nothing else. One camera family:
  a slow push-in over the whole piece (scale 1 to about 1.02, linear) plus the
  card carrying one matched cut between voting and resolved, so no flat
  crossfade between disconnected scenes.

ONE BODY SLOT (this fixes the collisions; obey it strictly)
The hero card has exactly ONE body region under the meta row. It holds ONE
state at a time. When a state changes, the outgoing content fully fades and
lifts out (150ms, exit easing) and is removed BEFORE the incoming content
enters (240ms, enter easing). Never render two states in that slot at once:
never a clock line behind a vote confirmation, never the vote buttons under a
chip, never the tally under the buttons. The card body's height may ease
between states, but only one set of elements is ever visible in it. The same
rule applies to the label under the card: one line at a time, the old exits
before the new enters.

NEVER
- No second accent, no electric blue, no gradient besides the field radial, no
  dark theme, no pure #FFFFFF, no pure black.
- No default or linear easing on a move, no scale-from-0, no layout-property
  animation, no two dominant motions at once, no stagger of 100ms or more.
- No sharp or bright background element; the ambient layer is always blurred
  and dim. No overlapping body states (see ONE BODY SLOT).
- No title case (sentence case; mono labels uppercase). No lorem ipsum, no fake
  round numbers: use the exact sample data in the piece prompt.
- No invented product UI: no nav, no footer chrome, no charts, no stats the
  piece does not name.
```

### 7.2 The piece prompt (paste right after the system prompt)

```
Build the piece. 15 seconds, one timeline, three layers, the real Conclave UI in
motion with short kinetic labels, at these exact timestamps. Fast pace: a new
focal moment about every 1 to 1.5 seconds, one dominant motion at a time, a beat
of stillness between moments. All text is real HTML (crisp). The hero card is
the lead and carries every cut; the ambient layer lives underneath the whole
time.

THE ONE JOB: in 15 seconds, show a stranger the whole Conclave flow, vote
sealed, tally revealed, money paid in secret, inside a living confidential
workspace. The held moment is the green seal stamping the passed verdict.

BEAT 0, the workspace wakes (0.0s to 0.9s), ambient only, no hero yet
- 0.0s: the warm field. The large faint bronze seal watermark begins its slow
  breath.
- 0.2s: the ambient layer fades up over 700ms: 2 or 3 blurred ghost ballot
  cards drift in at the edges, the ciphertext field (14 to 22 faint drifting
  fragments) begins its slow loops, and the frame furniture draws on (the 1px
  inset frame, the four bronze corner marks, top-left "CONCLAVE (middot)
  CONFIDENTIAL LEDGER", bottom-left "SEPOLIA", bottom-right the block ticker
  starting to roll). All of it stays dim and blurred.

BEAT 1, the hero card arrives (0.9s to 3.0s)
- 0.9s: the sharp hero card fade-rises 16px into center, 240ms, enter easing:
  Fraunces title "Fund the Q3 open-source grant round (250 cGOV)", a bronze
  "Voting" pill with a breathing dot top right. It is the only in-focus object.
- 1.4s: its meta row assembles on the 60ms stagger: mono "BALLOT 4", the
  beneficiary chip "0x15f8...0cef", the ciphertext chip "payout".
- 1.9s: BODY STATE A enters the slot: a mono clock line "Closes in 06:14:22"
  (the last two digits tick down once a second) with the two vote pills below,
  ink "Vote yes" and quiet "Vote no".
- 2.3s: the label rises under the card: "A ballot on Ethereum. Its payout is
  already sealed."

BEAT 2, the vote seals (3.0s to 6.2s)
- 3.2s: "Vote yes" presses (scale 0.97 and back, 150ms) with one bronze
  focus-ring flash.
- 3.5s: BODY STATE A clears: the clock line and both pills fade and lift out
  (150ms, exit easing) and are removed.
- 3.75s: BODY STATE B enters the cleared slot: a green check + "Your encrypted
  vote is in.", and below it a sealed ciphertext chip "your vote (three
  blocks)" fade-rises. Nothing overlaps; the slot held A, now holds B.
- 4.1s: one ciphertext fragment out in the ambient field brightens briefly and
  drifts away (the vote joining the encrypted air), then settles back to faint.
- 4.4s: the label swaps (old exits up 150ms, new enters 240ms): "Encrypted in
  the browser. On-chain, just a handle."

BEAT 3, the reveal (6.2s to 10.0s), the same card resolves
- 6.4s: matched cut: the card lifts 8px; its "Voting" pill crossfades to a green
  "Passed" pill (the pill only, 240ms); BODY STATE B clears out (150ms).
- 6.7s: BODY STATE C enters: the tally block. The bar grows from the left
  (scaleX 0 to 1, transform-origin left, 440ms, enter easing), green about 64%,
  the rest the no wash.
- 7.1s: the two counts count up 520ms, decelerating, tabular: green "2 yes",
  muted "1 no".
- 8.0s: the label swaps to "The chain counted every vote without reading one."
- 8.6s: the single specular sweep crosses the card (under 900ms), and the green
  wax seal stamps in beside the tally (scale 1.12 to 1, 200ms, the overshoot)
  with the line "Passed."

BEAT 4, the confidential payout (10.0s to 12.3s)
- 10.2s: a small treasury balance chip slides in at the card's lower edge, in
  its own space: a ciphertext chip "balance (three blocks)".
- 10.9s: it flips on the x-axis (200ms) to a mono tabular "500 cGOV" in ink; a
  bronze underline draws under it left to right.
- 11.3s: the label swaps to "Paid to the beneficiary. The amount never appeared
  in clear."

BEAT 5, the end card (12.3s to 15.0s), held
- 12.5s: the hero card and the frame furniture recede and fade (300ms, exit
  easing). The ciphertext fragments drift inward and dim toward the center.
- 12.7s: the bronze seal travels to center and lands (a matched cut on the
  seal), the watermark resolving into it.
- 13.0s: the wordmark "Conclave" mask-rises under the seal (translateY 100% to
  0), Fraunces about 100px, 700ms.
- 13.8s: the tagline "Private votes. Public outcomes. Confidential money."
  fade-rises, muted, about 21px, 600ms.
- 14.3s: a mono footnote "BUILT ON ZAMA FHEVM (middot) LIVE ON SEPOLIA", faint,
  12.5px, tracking 0.16em. Use a real middot glyph.
- 14.4s to 15.0s: dead still. The cleanest frame; only the grain and the last
  of the push-in move.

CHECK BEFORE YOU OUTPUT
- Three layers are alive: a blurred, dim ambient background (ghost cards,
  ciphertext field, frame furniture, block ticker), a single sharp hero card,
  and a low finishing pass. The field is never empty around the card.
- ONE BODY SLOT held: no frame ever shows two body states at once (no clock
  behind the confirmation, no buttons under a chip). Verify each transition.
- One accent (bronze); verdict green and the losing wash only on the pill, the
  tally, and the seal. The ambient layer is always dimmer and blurrier than the
  hero.
- One dominant motion per instant; the card carries the cuts; 60ms is the only
  stagger; the seal stamp and the button press are the only overshoots; one
  specular sweep, once.
- Every label reads before it exits (short lines, about 1.5s each).
- prefers-reduced-motion lands on the final card, identical layout, all drift
  and ticking frozen.
- Grain present but not nameable; the raw and finished frames differ.
```
