import { LockKeyhole } from "lucide-react";

/// The ciphertext chip, one of the two signature elements
/// (docs/UI_DESIGN_SYSTEM.md): every sealed value in the product renders as
/// this mono chip instead of plain text, so redaction is a recognizable mark.
export function SealedChip({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-well px-2 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted shadow-well"
      title={`${label}: encrypted on-chain`}
    >
      <LockKeyhole size={11} className="text-bronze" aria-hidden="true" />
      {label}
      <span className="tracking-normal text-faint" aria-hidden="true">
        &#9618;&#9618;&#9618;
      </span>
    </span>
  );
}
