# Conclave brand

Confidential governance. The product feel is serious, deliberate, and a little
ceremonial: a ballot paper on a warm table, sealed in bronze; only the outcome,
the white smoke, is ever shown.

## Direction

Warm light. An ivory paper field, deep warm ink, and a single bronze accent
that stands for the seal, the signal, the action. Primary actions are ink
pills; positive and negative verdicts are muted, never loud. Generous spacing,
hairline borders, one strong type contrast between a serif display and a clean
sans. The only drama is the reveal.

## Color tokens (light)

The full sheet lives in docs/UI_DESIGN_SYSTEM.md and web/src/app/globals.css;
these are the roles:

- paper (field): #F4F1E9, always layered with a bronze radial, a vignette, and
  4% film grain
- card: #FBFAF5, well (inputs, chips): #EDE9DE
- line: rgba(28,25,23,0.08), line-strong: rgba(28,25,23,0.16)
- ink (text, primary buttons): #1C1917, muted: #57534E, faint: #736E64
- bronze (only saturated accent): #9A5B13, deep #7A470E
- yes / no (verdicts only): #25704F / #A63D32
- focus ring: bronze at 70%

## Typography

- Display and headings: Fraunces (variable serif, weight up to 600), for
  gravitas.
- Body, UI: Geist Sans. Addresses, amounts, counts, eyebrows: Geist Mono.
- Tallies and token amounts use tabular figures.

## Tone and voice

- Plain and precise, no hype. Always say what stays private and what becomes public.
- Label encrypted values clearly: "encrypted", "sealed", "revealed".
- Short verbs on actions: Create, Vote, Close, Reveal, Execute.
