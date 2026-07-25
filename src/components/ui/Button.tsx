"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

// Text colors are chosen for WCAG AA contrast (4.5:1) against each
// variant's background, verified by direct calculation — not just visual
// judgment — since the color palette itself is locked and can't be
// adjusted to fix a bad pairing. White-on-primary (#1fb6aa) measures only
// 2.52:1 and fails AA, so `primary` uses the existing --color-text-primary
// token instead of white; every other variant's white/trust-navy pairing
// already passes (4.83:1–11.48:1). See DESIGN_ASSUMPTIONS.md D2.3.
const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-text-primary hover:opacity-90",
  secondary: "bg-trust-navy text-white hover:opacity-90",
  outline: "bg-white text-trust-navy border border-border hover:bg-background-alt",
  danger: "bg-error text-white hover:opacity-90",
};

const spinnerToneClasses: Record<ButtonVariant, string> = {
  primary: "border-text-primary/30 border-t-text-primary",
  secondary: "border-white/40 border-t-white",
  outline: "border-trust-navy/30 border-t-trust-navy",
  danger: "border-white/40 border-t-white",
};

// sm is 44px tall (not the 36px it used to be) to meet the 44x44px minimum
// touch target size — see DESIGN_ASSUMPTIONS.md D2.3.
const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-11 px-[var(--space-sm)] text-body-sm",
  md: "h-[50px] px-[var(--space-md)] text-body",
  lg: "h-14 px-[var(--space-lg)] text-h3",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    disabled,
    className = "",
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className={`h-4 w-4 animate-spin rounded-full border-2 ${spinnerToneClasses[variant]}`}
        />
      )}
      {children}
    </button>
  );
});
