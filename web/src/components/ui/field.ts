// Shared form field styling so every input, select, and textarea in the app
// reads identically: a recessed well one step below the card, quiet resting
// border that strengthens on hover, bronze focus outline.
export const fieldClasses =
  "w-full rounded-[10px] border border-line bg-well px-3.5 text-sm text-ink shadow-well placeholder:text-faint " +
  "transition-[border-color] duration-150 ease-soft hover:border-line-strong " +
  "focus:outline-2 focus:outline-offset-2 focus:outline-bronze/70 " +
  "disabled:cursor-not-allowed disabled:text-faint";

export const inputClasses = `h-11 ${fieldClasses}`;

export const textareaClasses = `min-h-16 resize-y py-[11px] ${fieldClasses}`;

// Eyebrow micro-label: mono, uppercase, wide tracking, faint ink. The
// precision voice of the product (ballot ids, field labels, meta rows).
export const microLabelClasses = "font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint";
