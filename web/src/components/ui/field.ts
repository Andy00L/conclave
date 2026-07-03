// Shared form field styling so every input, select, and textarea in the app
// reads identically: quiet resting border, ember focus ring, no bg swap.
export const fieldClasses =
  "w-full rounded-md border border-line bg-ink px-3 text-sm text-fg placeholder:text-muted/50 " +
  "transition-shadow duration-100 ease-soft " +
  "focus:border-ember/40 focus:outline-none focus:ring-2 focus:ring-ember/50";

export const inputClasses = `h-10 ${fieldClasses}`;

export const textareaClasses = `resize-none py-2.5 ${fieldClasses}`;

// Uppercase micro-label above fields and on card meta rows (+tracking per
// design-taste: loosen letter-spacing on uppercase).
export const microLabelClasses = "text-xs font-medium uppercase tracking-wider text-muted";
