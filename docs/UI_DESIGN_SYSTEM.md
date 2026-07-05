# Conclave UI design system (the per-project sheet, v2)

The single source of truth for every rendered value. Components read tokens
from `web/src/app/globals.css`; no literal colors, radii, shadows, or
durations in components. House style in one line: a ballot paper on a warm
table, ink and one bronze seal; the only drama is the reveal.

v2 decision (2026-07-05): the dark obsidian v1 is retired. The product moves
to a warm light editorial system (the Wealthsimple discipline: warm field,
one accent, restraint as the brand), which fits the conclave domain (paper
ballots, wax seals) and separates the app from the default dark dashboard
every other dApp ships.

Register: calm trust, editorial, ceremonial. References for discipline, never
pixels: Wealthsimple (warm palette restraint), Apple (one held reveal),
Stripe (numbers treated beautifully). Density: focused dashboard. Theme
scope: light only, committed.

## Palette (seven roles)

| Role | Token | Value |
| --- | --- | --- |
| Field | `--color-paper` | `#F4F1E9`, never flat: warm radial + vignette + 4% grain |
| Surface | `--color-card` | `#FBFAF5` (the card material) |
| Well | `--color-well` | `#EDE9DE` (inputs, chips, skeletons; recessed) |
| Ink | `--color-ink` | `#1C1917` (primary text, primary button fill) |
| Muted ink | `--color-muted` | `#57534E` |
| Faint ink | `--color-faint` | `#736E64` (eyebrows, disabled; 4.5:1 on paper, the floor) |
| Accent | `--color-bronze` | `#9A5B13` (deep `#7A470E`, wash `rgba(154,91,19,0.08)`) |
| Reserved | `--color-yes` / `--color-no` | `#25704F` / `#A63D32`, verdicts only, once per card |

Hairlines: `--color-line` `rgba(28,25,23,0.08)`, `--color-line-strong`
`rgba(28,25,23,0.16)`. Bronze is the only saturated color at rest (links,
focus rings, active states, the seal, the Voting pill). Yes/no appear only
where a verdict or a vote outcome is the content; errors reuse `--color-no`.
Verdict pills sit on their wash (`rgba(37,112,79,0.10)` / `rgba(166,61,50,0.10)`).

Contrast pre-check on `#F4F1E9` (WCAG, computed at token time): ink 14:1,
muted 6.8:1, faint 4.5:1, bronze 4.8:1, yes 5.3:1, no 5.6:1. Paper text
`#F7F5EF` on the ink button: 13:1.

## The field recipe (never a flat white)

```css
background:
  radial-gradient(1100px 500px at 50% -10%, rgba(154,91,19,0.06), transparent 60%),
  radial-gradient(130% 100% at 50% 50%, transparent 60%, rgba(28,25,23,0.045) 100%),
  #F4F1E9;
```

Plus one animated film-grain overlay at 4% opacity (a small tiling noise
image stepped, never static, disabled under reduced motion).

## Material: the paper card

One recipe for every panel; one light source from above; layered shadows,
never one flat shadow; never nested:

- fill `#FBFAF5`; border 1px `--color-line`; radius 18px
- shadow stack: `0 1px 2px rgba(28,25,23,0.05), 0 8px 24px -12px rgba(28,25,23,0.10), 0 24px 48px -28px rgba(28,25,23,0.08)`
- interactive hover: border rises to `--color-line-strong`, the stack deepens
  one step, `translateY(-1px)`, 200ms standard easing
- wells (inputs, ciphertext chips, skeleton blocks): `--color-well` with
  `inset 0 1px 2px rgba(28,25,23,0.06)`

## Buttons

- Primary: an ink pill. Height 44px, radius 999px, fill `--color-ink`, text
  `#F7F5EF`, weight 500; shadow `0 1px 2px rgba(28,25,23,0.20), 0 8px 20px -10px rgba(28,25,23,0.35)`;
  hover fill `#322D28` + `translateY(-1px)`; press scale 0.98; disabled 40%
  opacity, no shadow.
- Quiet: transparent pill, 1px hairline border, ink text; hover fills with
  the well color.
- Focus everywhere: 2px ring `rgba(154,91,19,0.7)`, offset 2px.

## Type

- Display and card titles: Fraunces, letter-spacing -0.02em, weight 500 to
  600 (the ceiling).
- UI text: Geist Sans, 14 to 16px. Weight ceiling 600.
- Precision (addresses, amounts, counts, eyebrows): Geist Mono, tabular.
- Eyebrow: mono, 11px, uppercase, tracking 0.14em, `--color-faint`.

## Space and shape

- Spacing base 4px; card padding 24px; column gap 24px.
- Radii: 8 (chips), 10 (inputs), 18 (cards), full (buttons, pills).
- Content max width 68rem, one primary action per view.

## Motion tokens

- Durations: 100 micro / 200 standard / 300 large / 500 reserved for the
  tally reveal only. Exits run 20% shorter than enters.
- Easings: enter `cubic-bezier(0.16, 1, 0.3, 1)`, standard
  `cubic-bezier(0.4, 0, 0.2, 1)`, exit `cubic-bezier(0.4, 0, 1, 1)`.
- Stagger constant 50ms (list entrances). Press scale 0.98.
- Overshoot budget: the seal stamp only (scale 1.12 to 1, once).
- Page entrance: hero fade-rises 12px over 300ms, then cards fade-rise 8px
  with the 50ms stagger. One thing moves at a time.
- Transform and opacity only. Reduced motion collapses every entrance, the
  tally growth, and the grain to opacity or none, identical final layout.

## Signature elements (two, from the domain)

1. **The wax seal.** An SVG ring (1.5px stroke at 45% opacity) around a
   filled core. Bronze beside the wordmark in the header; green or red
   stamped once beside the verdict line of each resolved ballot. Nowhere
   else.
2. **The ciphertext chip.** Every sealed value (payout, encrypted balance)
   renders as one mono chip: lock glyph (bronze) + label + three shade
   blocks (U+2592) on a well, hairline border, radius 8px. Sealed data is
   never plain prose.

## The hero moment

The reveal on a resolved ballot: the 8px tally bar grows (scaleX from 0,
transform-origin left, 500ms, enter easing), the mono counts count up over
700ms decelerating, then the wax seal stamps in 200ms later (opacity +
scale 1.12 to 1, the single overshoot). Everything else on the screen stays
quieter than this moment.
