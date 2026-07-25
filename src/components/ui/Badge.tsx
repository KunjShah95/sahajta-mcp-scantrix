import { HTMLAttributes } from "react";

type BadgeVariant = "success" | "warning" | "error" | "neutral";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

// success/warning use dark text on a tinted background rather than the
// success/warning color itself as text — text-success (#16a34a) and
// text-warning (#f59e0b) measure only 3.30:1 and 2.15:1 against their own
// light tint backgrounds, both failing WCAG AA's 4.5:1 minimum. error's
// pairing already passes (4.83:1) so it's unchanged. The tinted background
// still carries the color-coding; only the text color changes, and only to
// an already-locked token. See DESIGN_ASSUMPTIONS.md D2.3.
const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-success/10 text-text-primary",
  warning: "bg-warning/10 text-text-primary",
  error: "bg-error/10 text-error",
  neutral: "bg-background-alt text-text-secondary",
};

export function Badge({ variant = "neutral", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-[var(--space-sm)] py-[var(--space-xs)] text-caption font-semibold ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
