/// The wax seal, the product's mark (docs/UI_DESIGN_SYSTEM.md): a ring around
/// a filled core. Bronze in the header; stamped once beside the verdict of
/// every resolved ballot, where `tone` follows the verdict. `className` and
/// `style` let the reveal choreography stamp it in with a delay.
export function SealStamp({
  size = 20,
  tone = "bronze",
  className = "",
  style,
}: {
  size?: number;
  tone?: "bronze" | "yes" | "no";
  className?: string;
  style?: React.CSSProperties;
}) {
  const color = tone === "yes" ? "var(--color-yes)" : tone === "no" ? "var(--color-no)" : "var(--color-bronze)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      style={style}
    >
      <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeOpacity="0.45" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="5.5" fill={color} />
    </svg>
  );
}
