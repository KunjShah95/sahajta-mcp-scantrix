import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = "", id, name, ...props },
  ref,
) {
  const inputId = id ?? name;
  return (
    <div className="flex flex-col gap-[var(--space-xs)]">
      {label && (
        <label htmlFor={inputId} className="text-body-sm font-semibold text-trust-navy">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        name={name}
        className={`h-[50px] rounded-md border bg-white px-[var(--space-md)] text-body text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40 ${
          error ? "border-error" : "border-border"
        } ${className}`}
        {...props}
      />
      {error && <p className="text-caption font-medium text-error">{error}</p>}
    </div>
  );
});
