/// The seal, the product's mark (docs/UI_DESIGN_SYSTEM.md): a ring with an
/// ember core. Used in the header and stamped once on every resolved ballot.
/// `tone` follows the verdict on resolved cards.
export function SealStamp({ size = 20, tone = "ember" }: { size?: number; tone?: "ember" | "yes" | "no" }) {
  const color = tone === "yes" ? "var(--color-yes)" : tone === "no" ? "var(--color-no)" : "var(--color-ember)";
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className="shrink-0">
      <circle cx="10" cy="10" r="8.5" fill="none" stroke={color} strokeOpacity="0.45" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="3" fill={color} />
    </svg>
  );
}
