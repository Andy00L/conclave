# Conclave UI design system (the per-project sheet)

The single source of truth for every rendered value. Components read tokens
from `web/src/app/globals.css`; no literal colors, radii, shadows, or
durations in components. House style in one line: a sealed chamber at night,
lit by one ember; the only drama is the reveal.

Register: calm trust with a ceremonial edge. References: Linear (structure and
restraint), Vercel (card light in the dark), Wealthsimple (warm palette
discipline). Density: focused dashboard. Theme scope: dark only, committed.

## Palette (seven roles)

| Role | Token | Value |
| --- | --- | --- |
| Field | `--color-ink` | `#0b0e14`, never flat: two ember radials + vignette |
| Surface | `--color-surface` | `#12161e` (one lightness step up) |
| Raised | `--color-raised` | `#1a1f2a` (second step: skeletons, wells) |
| Ink | `--color-fg` | `#e9ebf0` |
| Muted ink | `--color-muted` | `#9aa3b2` |
| Faint ink | `--color-faint` | `#737e8f` (eyebrows, disabled, empty; 4.5:1 on the field) |
| Accent | `--color-ember` | `#e8a13a` (strong `#f2b457`, deep `#a06618`) |
| Reserved | `--color-yes` / `--color-no` | `#3fb984` / `#e86b6b`, verdicts only, once per card |

Hairlines: `--color-line` `rgba(255,255,255,0.07)`, `--color-line-strong`
`rgba(255,255,255,0.14)`. Ember is the only saturated color at rest; yes/no
appear only where a verdict or a vote action is the content.

## Material: the obsidian card

One recipe for every panel. Dark elevation = lightness step + lit top edge +
layered shadow (never a single flat shadow):

- fill: `linear-gradient(180deg, rgba(255,255,255,0.035), transparent 45%)`
  over `--color-surface`
- border: 1px `--color-line`
- inner light: `inset 0 1px 0 rgba(255,255,255,0.05)`
- depth: `0 1px 2px rgba(0,0,0,0.35), 0 16px 40px -20px rgba(0,0,0,0.6)`
- interactive hover: border rises to `--color-line-strong` plus a faint ember
  glow; never a second material, never glass on glass.

## Type

- Display and card titles: Fraunces, tight tracking, weight up to 600.
- UI text: Geist Sans. Weight ceiling 600.
- Precision (addresses, amounts, eyebrows, counts): Geist Mono, tabular.
- Eyebrow: mono, 11px, uppercase, tracking 0.14em, `--color-faint`.

## Space and shape

- Spacing base 4px; card padding 20 to 24px; column gap 24px.
- Radii: 8 (chips, inputs), 10 (buttons), 14 (cards), full (pills).
- Content max width 64rem (`max-w-5xl`), one primary action per view.

## Motion tokens

- Durations: 100 micro / 200 standard / 300 large / 500 hero reveal.
- Easings: enter `cubic-bezier(0.16, 1, 0.3, 1)`, standard
  `cubic-bezier(0.4, 0, 0.2, 1)`, exit `cubic-bezier(0.4, 0, 1, 1)`.
- Stagger constant 50ms (ballot list entrance). Press scale 0.98.
- Reduced motion collapses every entrance and the tally growth to none.

## Signature elements (two, from the domain)

1. **The seal.** A ring with an ember core: the header mark, and a stamp on
   every resolved ballot next to its verdict. Placement rule: once per screen
   in the header, once per resolved card, nowhere else.
2. **The ciphertext chip.** Every sealed value (payout, encrypted balance)
   renders as one mono chip: lock glyph + four blocks (`▚▚▚▚`). It is the
   product's redaction mark; sealed data is never plain text in a sentence.

## The hero moment

The reveal. The tally bar on a resolved ballot: an 8px segmented bar, yes in
green with a soft glow seam, counts in mono, grown once on entry (scaleX,
500ms, enter easing) with the verdict stamp beside it. Everything else on the
screen stays quieter than this moment.
