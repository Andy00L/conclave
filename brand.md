# Conclave brand

Confidential governance. The product feel is serious, deliberate, and a little ceremonial: a room where votes are sealed and only the outcome, the white smoke, is ever shown.

## Direction

Dark first. An ink background, off-white text, and a single warm ember accent that stands for the signal, the reveal, the action. Positive and negative states are muted, never loud. Generous spacing, quiet borders, and one strong type contrast between a serif display and a clean sans.

## Color tokens (dark)

The full sheet lives in docs/UI_DESIGN_SYSTEM.md and web/src/app/globals.css;
these are the roles:

- ink (field): #0B0E14, always layered with two ember radials and a vignette
- surface: #12161E, raised: #1A1F2A (elevation = lightness steps)
- line: rgba(255,255,255,0.07), line-strong: rgba(255,255,255,0.14)
- text: #E9EBF0, muted: #9AA3B2, faint: #737E8F
- ember (only saturated accent): #E8A13A, strong #F2B457, deep #A06618
- yes / no (verdicts only): #3FB984 / #E86B6B
- focus ring: ember at 70%

## Typography

- Display and headings: Fraunces (serif), for gravitas.
- Body, UI, numbers: Geist Sans (ships with the scaffold).
- Tallies and token amounts use tabular figures.

## Tone and voice

- Plain and precise, no hype. Always say what stays private and what becomes public.
- Label encrypted values clearly: "encrypted", "sealed", "revealed".
- Short verbs on actions: Create, Vote, Close, Reveal, Execute.
