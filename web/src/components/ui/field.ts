// Shared form field styling so every input, select, and textarea in the app
// reads identically: a well one step below the card, quiet resting border,
// ember focus ring, no background swap on focus.
export const fieldClasses =
  "w-full rounded-lg border border-line bg-ink/60 px-3 text-sm text-fg placeholder:text-faint " +
  "transition-[border-color,box-shadow] duration-200 ease-soft " +
  "focus:border-ember/40 focus:outline-none focus:ring-2 focus:ring-ember/50";

export const inputClasses = `h-10 ${fieldClasses}`;

export const textareaClasses = `resize-none py-2.5 ${fieldClasses}`;

// Eyebrow micro-label: mono, uppercase, wide tracking, faint ink. The
// precision voice of the product (ballot ids, field labels, meta rows).
export const microLabelClasses = "font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint";
