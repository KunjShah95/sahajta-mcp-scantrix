const SIZE_CLASSES = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-4",
  lg: "h-10 w-10 border-4",
} as const;

const TONE_CLASSES = {
  primary: "border-primary/20 border-t-primary",
  white: "border-white/30 border-t-white",
} as const;

// Consolidates a spinner markup pattern that was already identical
// (copy-pasted) across AuthGate, InviteAcceptContent, InvoiceDetailContent,
// InvoiceReviewContent, InvoicePreviewContent — one shared primitive instead
// of five duplicated inline spans. Per DESIGN_ASSUMPTIONS.md D2.2 research,
// used for short/blocking waits (whole-page or button state); list content
// loading uses Skeleton instead.
export function Spinner({
  size = "md",
  tone = "primary",
  className = "",
}: {
  size?: keyof typeof SIZE_CLASSES;
  tone?: keyof typeof TONE_CLASSES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block animate-spin rounded-full ${SIZE_CLASSES[size]} ${TONE_CLASSES[tone]} ${className}`}
    />
  );
}
