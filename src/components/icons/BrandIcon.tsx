import { siGoogledrive, siQuickbooks, siZoho } from "simple-icons";

// Licensed brand marks (CC0-1.0, simple-icons — built specifically for
// representing third-party brands/integrations, see DESIGN_ASSUMPTIONS.md
// D1.1). Each brand's own official mark color is used here deliberately,
// same as any "Connect to X" button showing X's real logo — this is not a
// repurposing of this app's locked --color-* tokens.
const BRANDS = {
  quickbooks: siQuickbooks,
  "google-drive": siGoogledrive,
  zoho: siZoho,
} as const;

export type BrandName = keyof typeof BRANDS;

// Tally (Tally Solutions / TallyPrime) has no entry in simple-icons or any
// other legitimately-licensed brand-mark source found during D1.1 research
// — never scrape or hand-approximate a trademarked logo, so it intentionally
// has no case here. Callers render it as a plain wordmark instead (see
// AccountingSoftwaresContent.tsx).
export function BrandIcon({
  name,
  size = 24,
  className,
}: {
  name: BrandName;
  size?: number;
  className?: string;
}) {
  const icon = BRANDS[name];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={`#${icon.hex}`}
      className={className}
      role="img"
      aria-label={icon.title}
    >
      <path d={icon.path} />
    </svg>
  );
}
