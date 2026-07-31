"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { forgotPassword } from "@/store/auth/authApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { showToast } from "@/lib/dialogManager";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const validateEmail = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "Email is required";
  if (!isValidEmail(trimmed)) return "Enter a valid email address";
  return "";
};

export function ForgotPasswordContent() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const loading = useAppSelector((state) => state.auth.loading);

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const currentEmailError = validateEmail(email);
    setTouched(true);
    setEmailError(currentEmailError);
    if (currentEmailError) return;

    setFormError("");
    const trimmedEmail = email.trim().toLowerCase();
    const result = await dispatch(forgotPassword({ email: trimmedEmail }));

    if (forgotPassword.fulfilled.match(result)) {
      showToast("If an account exists for that email, a reset code has been sent.", "success");
      router.push(`/forgot-password/reset?email=${encodeURIComponent(trimmedEmail)}`);
    } else {
      const payload = result.payload;
      setFormError(typeof payload === "string" ? payload : "Could not send reset code");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background-soft px-[var(--space-lg)] py-[var(--space-xxl)]">
      <div className="w-full max-w-md">
        <Link
          href="/login"
          className="mb-[var(--space-md)] flex items-center gap-1 text-body-sm font-semibold text-trust-navy"
        >
          <ChevronLeft size={18} strokeWidth={2.25} />
          Back to sign in
        </Link>

        <div className="mb-[var(--space-xl)] text-center">
          <h1 className="text-h1 font-bold text-trust-navy">Forgot password?</h1>
          <p className="mt-[var(--space-sm)] text-body text-text-secondary">
            Enter the email on your account and we&apos;ll send you a code to reset your password.
          </p>
        </div>

        <Card>
          <form className="flex flex-col gap-[var(--space-md)]" onSubmit={handleSubmit} noValidate>
            <Input
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="Enter your email"
              value={email}
              disabled={loading}
              error={touched ? emailError : ""}
              onChange={(event) => {
                setEmail(event.target.value);
                if (touched) setEmailError(validateEmail(event.target.value));
              }}
              onBlur={() => {
                setTouched(true);
                setEmailError(validateEmail(email));
              }}
            />

            {formError && (
              <div className="rounded-md border-l-4 border-error bg-error/10 px-[var(--space-sm)] py-[var(--space-xs)] text-body-sm font-medium text-error">
                {formError}
              </div>
            )}

            <Button type="submit" loading={loading} disabled={!isValidEmail(email) || loading}>
              Send reset code
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
