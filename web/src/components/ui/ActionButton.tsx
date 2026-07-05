"use client";

import { LoaderCircle } from "lucide-react";

// The one button used across the app: pill shape, bronze focus ring, 200ms
// transitions on the soft curve, press feedback at scale 0.98 (never lower).
const BASE_CLASSES =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-medium " +
  "transition-[background-color,border-color,box-shadow,translate,scale,opacity] duration-150 ease-soft active:scale-[0.98] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze/70 focus-visible:ring-offset-2 focus-visible:ring-offset-paper " +
  "disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none";

// Primary is the ink pill (the only filled button on screen); quiet is a
// hairline pill that fills with the well on hover. Primary lifts 2px on hover.
const TONE_CLASSES = {
  primary: "bg-ink text-paper-bright shadow-btn hover:-translate-y-0.5 hover:bg-ink-soft",
  quiet: "border border-line-strong bg-transparent text-ink hover:bg-well",
} as const;

// md is the standard 44px control; sm is the 36px header/inline variant.
const SIZE_CLASSES = {
  md: "h-11 px-6 text-sm",
  sm: "h-9 px-4 text-sm",
} as const;

export function ActionButton({
  label,
  pendingLabel,
  isPending = false,
  disabled = false,
  onClick,
  tone = "primary",
  size = "md",
  type = "button",
  fullWidth = false,
  href,
}: {
  label: React.ReactNode;
  pendingLabel?: string;
  isPending?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  tone?: keyof typeof TONE_CLASSES;
  size?: keyof typeof SIZE_CLASSES;
  type?: "button" | "submit";
  fullWidth?: boolean;
  href?: string;
}) {
  const combinedClasses = `${BASE_CLASSES} ${TONE_CLASSES[tone]} ${SIZE_CLASSES[size]} ${fullWidth ? "w-full" : ""}`;

  // External destinations (the Sepolia ETH faucet) share the pill styling but
  // render as a link: new tab, no opener access for the target page.
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={combinedClasses}>
        {label}
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isPending}
      aria-busy={isPending}
      className={combinedClasses}
    >
      {isPending && <LoaderCircle size={14} className="animate-spinner shrink-0" aria-hidden="true" />}
      {isPending && pendingLabel ? pendingLabel : label}
    </button>
  );
}
