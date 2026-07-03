"use client";

// The one button used across the app: consistent radius, 40px hit target,
// ember focus ring, sub-100ms press feedback. Two tones only, so the primary
// action always stands alone on a surface.
const BASE_CLASSES =
  "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-4 text-sm font-medium " +
  "transition-colors duration-100 ease-soft active:translate-y-px " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface " +
  "disabled:pointer-events-none disabled:opacity-50";

const TONE_CLASSES = {
  ember: "bg-ember text-ink hover:bg-ember-strong",
  quiet: "border border-line text-fg hover:border-ember/40 hover:text-ember-strong",
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
