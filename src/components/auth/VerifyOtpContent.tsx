"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Mail } from "lucide-react";
import { ChangeEvent, ClipboardEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { resendRegisterOtp, verifyRegisterOtp } from "@/store/auth/authApi";
import { acceptQBInvite } from "@/store/quickBooks/quickBooksApi";
import { showToast } from "@/lib/dialogManager";

const OTP_LENGTH = 6;
const RESEND_COUNTDOWN = 60;

export function VerifyOtpContent() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const loading = useAppSelector((state) => state.auth.loading);

  const email = searchParams.get("email") ?? "";
  const inviteToken = searchParams.get("inviteToken") ?? "";

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!email) {
      router.replace("/register");
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

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      const next = [...otp];
      next[index - 1] = "";
      setOtp(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const isOtpComplete = otp.every((d) => d !== "");

  const handleVerify = async () => {
    if (!isOtpComplete) return;
    const code = otp.join("");
    const result = await dispatch(verifyRegisterOtp({ email, otp: code }));

    if (verifyRegisterOtp.fulfilled.match(result)) {
      if (inviteToken) {
        const acceptResult = await dispatch(acceptQBInvite({ inviteToken }));
        if (!acceptQBInvite.fulfilled.match(acceptResult)) {
          const payload = acceptResult.payload as { message?: string } | undefined;
          showToast(
            payload?.message ||
              "Your account is ready, but we couldn't link your invite. You can ask for a new invite from your dashboard.",
            "error",
          );
        }
      }
      router.replace("/dashboard");
    } else {
      const payload = result.payload;
      showToast(typeof payload === "string" ? payload : "Invalid OTP. Please try again.", "error");
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setResendLoading(true);
    try {
      const result = await dispatch(resendRegisterOtp({ email }));
      if (resendRegisterOtp.fulfilled.match(result)) {
        setOtp(Array(OTP_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
        setCountdown(RESEND_COUNTDOWN);
        setCanResend(false);
        showToast("A new verification code has been sent to your email.", "success");
      } else {
        const payload = result.payload;
        showToast(typeof payload === "string" ? payload : "Could not resend OTP.", "error");
      }
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center bg-background-soft px-[var(--space-lg)] pt-[var(--space-lg)]">
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

      <h1 className="text-h2 font-bold text-trust-navy">Check your email</h1>
      <p className="mt-[var(--space-xs)] text-body text-text-secondary">We sent a 6-digit verification code to</p>
      <p className="mb-[var(--space-xl)] mt-1 font-bold text-trust-navy">{email}</p>

      <div className="mb-[var(--space-xl)] flex gap-1 sm:gap-[var(--space-sm)]">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            value={digit}
            onChange={(e) => handleOtpChange(e, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
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

      <button
        type="button"
        onClick={handleVerify}
        disabled={!isOtpComplete || loading}
        className="h-[50px] w-full max-w-xs rounded-md bg-primary font-bold text-white disabled:opacity-50"
      >
        {loading ? "Verifying…" : "Verify Email"}
      </button>

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
