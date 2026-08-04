"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Eye, EyeOff, Mail } from "lucide-react";
import { ChangeEvent, ClipboardEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { forgotPassword, resetPassword } from "@/store/auth/authApi";
import { showToast } from "@/lib/dialogManager";

const OTP_LENGTH = 6;
const RESEND_COUNTDOWN = 60;

const validatePassword = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "Password is required";
  if (trimmed.length < 6) return "Password must be at least 6 characters";
  return "";
};

export function ResetPasswordContent() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const loading = useAppSelector((state) => state.auth.loading);

  const email = searchParams.get("email") ?? "";

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [touched, setTouched] = useState({ password: false, confirm: false });
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!email) {
      router.replace("/forgot-password");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Fills every box from a single string of digits (a paste, or — as a
  // safety net — any other multi-character insert a browser hands us
  // despite maxLength=1) and focuses the next empty box, or the last box
  // once the whole code is filled.
  const distributeOtp = (rawValue: string) => {
    const digits = rawValue.replace(/[^0-9]/g, "").slice(0, OTP_LENGTH).split("");
    if (digits.length === 0) return;
    const next = Array(OTP_LENGTH).fill("");
    digits.forEach((d, i) => {
      next[i] = d;
    });
    setOtp(next);
    inputRefs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleOtpChange = (event: ChangeEvent<HTMLInputElement>, index: number) => {
    const raw = event.target.value.replace(/[^0-9]/g, "");
    if (raw.length > 1) {
      distributeOtp(raw);
      return;
    }
    const digit = raw.slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // maxLength=1 makes the browser truncate a pasted string down to one
  // character before onChange ever sees it — this runs first and reads the
  // clipboard directly, so the full code gets through.
  const handleOtpPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text");
    if (!/[0-9]/.test(pasted)) return;
    event.preventDefault();
    distributeOtp(pasted);
  };

  const handleOtpKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      const next = [...otp];
      next[index - 1] = "";
      setOtp(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const isOtpComplete = otp.every((d) => d !== "");
  const confirmMismatch = (value: string) => (value !== newPassword ? "Passwords do not match" : "");
  const isFormValid = isOtpComplete && !validatePassword(newPassword) && confirmPassword === newPassword;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const currentPasswordError = validatePassword(newPassword);
    const currentConfirmError = confirmMismatch(confirmPassword);
    setTouched({ password: true, confirm: true });
    setPasswordError(currentPasswordError);
    setConfirmError(currentConfirmError);
    if (!isOtpComplete || currentPasswordError || currentConfirmError) return;

    const result = await dispatch(
      resetPassword({ email, otp: otp.join(""), newPassword: newPassword.trim() }),
    );

    if (resetPassword.fulfilled.match(result)) {
      showToast("Your password has been reset.", "success");
      router.replace("/dashboard");
    } else {
      const payload = result.payload;
      showToast(typeof payload === "string" ? payload : "Could not reset password. Please try again.", "error");
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setResendLoading(true);
    try {
      const result = await dispatch(forgotPassword({ email }));
      if (forgotPassword.fulfilled.match(result)) {
        setOtp(Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
        setCountdown(RESEND_COUNTDOWN);
        setCanResend(false);
        showToast("A new reset code has been sent to your email.", "success");
      } else {
        const payload = result.payload;
        showToast(typeof payload === "string" ? payload : "Could not resend code.", "error");
      }
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center bg-background-soft px-[var(--space-lg)] py-[var(--space-lg)]">
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="Back"
        className="-m-2 self-start p-2 text-trust-navy"
      >
        <ChevronLeft size={26} strokeWidth={2.25} />
      </button>

      <span className="mb-[var(--space-lg)] mt-[var(--space-md)] flex h-18 w-18 items-center justify-center rounded-full bg-trust-navy/10">
        <Mail size={30} strokeWidth={1.75} className="text-trust-navy" />
      </span>

      <h1 className="text-h2 font-bold text-trust-navy">Reset your password</h1>
      <p className="mt-[var(--space-xs)] text-body text-text-secondary">We sent a 6-digit code to</p>
      <p className="mb-[var(--space-xl)] mt-1 font-bold text-trust-navy">{email}</p>

      <form className="flex w-full max-w-xs flex-col items-center gap-[var(--space-lg)]" onSubmit={handleSubmit} noValidate>
        <div className="flex gap-1 sm:gap-[var(--space-sm)]">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              value={digit}
              onChange={(e) => handleOtpChange(e, index)}
              onKeyDown={(e) => handleOtpKeyDown(e, index)}
              onPaste={handleOtpPaste}
              inputMode="numeric"
              maxLength={1}
              disabled={loading}
              className={`h-12 w-9 rounded-md border-2 text-center text-lg font-bold text-text-primary focus:outline-none sm:h-14 sm:w-12 sm:text-xl ${
                digit ? "border-trust-navy bg-trust-navy/10" : "border-border bg-white"
              }`}
            />
          ))}
        </div>

        <div className="w-full">
          <div className="flex items-center justify-between">
            <label htmlFor="newPassword" className="text-body-sm font-semibold text-trust-navy">
              New password
            </label>
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="-m-2 flex items-center gap-1 p-2 text-caption font-semibold text-primary"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <input
            id="newPassword"
            name="newPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Enter a new password"
            value={newPassword}
            disabled={loading}
            maxLength={50}
            onChange={(event) => {
              const value = event.target.value;
              setNewPassword(value);
              if (touched.password) setPasswordError(validatePassword(value));
              if (touched.confirm) setConfirmError(confirmMismatch(confirmPassword));
            }}
            onBlur={() => {
              setTouched((prev) => ({ ...prev, password: true }));
              setPasswordError(validatePassword(newPassword));
            }}
            className={`mt-[var(--space-xs)] h-[50px] w-full rounded-md border bg-white px-[var(--space-md)] text-body text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40 ${
              touched.password && passwordError ? "border-error" : "border-border"
            }`}
          />
          {touched.password && passwordError && (
            <p className="mt-[var(--space-xs)] text-caption font-medium text-error">{passwordError}</p>
          )}
        </div>

        <div className="w-full">
          <label htmlFor="confirmPassword" className="text-body-sm font-semibold text-trust-navy">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            disabled={loading}
            maxLength={50}
            onChange={(event) => {
              const value = event.target.value;
              setConfirmPassword(value);
              if (touched.confirm) setConfirmError(confirmMismatch(value));
            }}
            onBlur={() => {
              setTouched((prev) => ({ ...prev, confirm: true }));
              setConfirmError(confirmMismatch(confirmPassword));
            }}
            className={`mt-[var(--space-xs)] h-[50px] w-full rounded-md border bg-white px-[var(--space-md)] text-body text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40 ${
              touched.confirm && confirmError ? "border-error" : "border-border"
            }`}
          />
          {touched.confirm && confirmError && (
            <p className="mt-[var(--space-xs)] text-caption font-medium text-error">{confirmError}</p>
          )}
        </div>

        <Button type="submit" loading={loading} disabled={!isFormValid || loading} className="w-full">
          Reset password
        </Button>
      </form>

      <div className="mt-[var(--space-lg)] flex items-center gap-[var(--space-xs)] text-body-sm">
        <span className="text-text-secondary">Didn&apos;t receive the code?</span>
        {canResend ? (
          <button type="button" onClick={handleResend} disabled={resendLoading} className="font-bold text-primary">
            {resendLoading ? "…" : "Resend"}
          </button>
        ) : (
          <span className="font-semibold text-text-secondary">Resend in {countdown}s</span>
        )}
      </div>
    </div>
  );
}
