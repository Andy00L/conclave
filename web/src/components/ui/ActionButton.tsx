"use client";

// The one button used across the app: consistent radius, 40px hit target,
// ember focus ring, sub-100ms press feedback (scale 0.98, never lower).
const BASE_CLASSES =
  "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium " +
  "transition-[background-color,border-color,box-shadow,transform] duration-100 ease-soft active:scale-[0.98] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface " +
  "disabled:pointer-events-none disabled:opacity-50";

// Primary carries the only saturated fill on screen: a lit ember gradient
// with a top edge, deepening slightly on hover instead of just brightening.
const TONE_CLASSES = {
  ember:
    "bg-gradient-to-b from-ember-strong to-ember text-ink shadow-btn-ember " +
    "hover:from-ember-strong hover:to-ember-strong",
  quiet: "border border-line bg-raised/40 text-fg hover:border-line-strong hover:text-ember-strong",
} as const;

export function ActionButton({
  label,
  pendingLabel,
  isPending = false,
  disabled = false,
  onClick,
  tone = "ember",
  type = "button",
  fullWidth = false,
}: {
  label: React.ReactNode;
  pendingLabel?: string;
  isPending?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  tone?: keyof typeof TONE_CLASSES;
  type?: "button" | "submit";
  fullWidth?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isPending}
      aria-busy={isPending}
      className={`${BASE_CLASSES} ${TONE_CLASSES[tone]} ${fullWidth ? "w-full" : ""}`}
    >
      {isPending && pendingLabel ? pendingLabel : label}
    </button>
  );
}
