"use client";

import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { useEffect } from "react";

import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchMySubscription } from "@/store/subscription/subscriptionApi";

const STATUS_META: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-success/10 text-success" },
  trialing: { label: "Trial", className: "bg-primary/10 text-primary" },
  past_due: { label: "Past Due", className: "bg-warning/10 text-warning" },
  canceled: { label: "Canceled", className: "bg-background-alt text-text-secondary" },
  expired: { label: "Expired", className: "bg-error/10 text-error" },
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function SubscriptionStatusContent() {
  const dispatch = useAppDispatch();
  const subscription = useAppSelector((state) => state.subscription.subscription);
  const loading = useAppSelector((state) => state.subscription.subscriptionLoading);
  const error = useAppSelector((state) => state.subscription.subscriptionError);

  useEffect(() => {
    dispatch(fetchMySubscription());
  }, [dispatch]);

  if (loading && !subscription) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  if (error && !subscription) {
    return (
      <div className="mx-auto max-w-2xl p-[var(--space-lg)]">
        <ErrorState message={error} onRetry={() => dispatch(fetchMySubscription())} />
      </div>
    );
  }

  if (!subscription) return null;

  const statusMeta = STATUS_META[subscription.status] ?? { label: subscription.status, className: "bg-background-alt text-text-secondary" };
  const billingLabel =
    subscription.plan === "trial"
      ? "Free trial"
      : `${subscription.billingInterval === "yearly" ? "Yearly" : "Monthly"} billing`;

  return (
    <div className="mx-auto max-w-2xl p-[var(--space-lg)]">
      <h1 className="text-h2 font-bold text-trust-navy">Subscription</h1>

      <div className="mt-[var(--space-lg)] rounded-xl border border-border bg-white p-[var(--space-md)]">
        <div className="flex flex-wrap items-start justify-between gap-[var(--space-sm)]">
          <div className="min-w-0">
            <p className="text-caption text-text-secondary">Current plan</p>
            <p className="mt-[var(--space-xs)] break-words text-h1 font-bold text-trust-navy">{subscription.planName}</p>
          </div>
          <span className={`flex shrink-0 items-center gap-[var(--space-xs)] rounded-pill px-[var(--space-sm)] py-[var(--space-xs)] ${statusMeta.className}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            <span className="text-caption font-bold">{statusMeta.label}</span>
          </span>
        </div>

        <div className="my-[var(--space-md)] h-px bg-border" />

        <div className="flex items-center justify-between py-[var(--space-xs)]">
          <span className="text-body-sm text-text-secondary">Billing</span>
          <span className="text-body-sm font-bold text-text-primary">{billingLabel}</span>
        </div>
        <div className="flex items-center justify-between py-[var(--space-xs)]">
          <span className="text-body-sm text-text-secondary">
            {subscription.plan === "trial" ? "Trial ends" : "Next billing date"}
          </span>
          <span className="text-body-sm font-bold text-text-primary">
            {formatDate(subscription.plan === "trial" ? subscription.trialEndsAt : subscription.currentPeriod?.end)}
          </span>
        </div>
        <div className="flex items-center justify-between py-[var(--space-xs)]">
          <span className="text-body-sm text-text-secondary">QuickBooks slots</span>
          <span className="text-body-sm font-bold text-text-primary">
            {subscription.slotsUsed} of {subscription.maxSlots} slots used
          </span>
        </div>
        {subscription.downgradeAvailableAt && (
          <div className="flex items-center justify-between py-[var(--space-xs)]">
            <span className="text-body-sm text-text-secondary">Downgrade available</span>
            <span className="text-body-sm font-bold text-text-primary">{formatDate(subscription.downgradeAvailableAt)}</span>
          </div>
        )}
      </div>

      {subscription.slots.length > 0 && (
        <>
          <p className="mb-[var(--space-sm)] mt-[var(--space-lg)] text-caption font-bold uppercase tracking-wide text-text-secondary">
            Connected companies
          </p>
          <div className="flex flex-col gap-[var(--space-xs)]">
            {subscription.slots.map((slot) => (
              <div
                key={slot.qbConnectionId}
                className="flex flex-wrap items-center justify-between gap-[var(--space-sm)] rounded-lg border border-border bg-white px-[var(--space-md)] py-[var(--space-sm)]"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-text-primary">{slot.name}</p>
                  <p className="text-caption text-text-secondary">Realm ID: {slot.realmId}</p>
                </div>
                {slot.locked && (
                  <span className="flex shrink-0 items-center gap-1 rounded-pill bg-warning/10 px-[var(--space-sm)] py-[var(--space-xs)] text-caption font-bold text-warning">
                    <Lock size={12} strokeWidth={2.5} />
                    Locked until {formatDate(slot.unlockAt)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <Link
        href="/plans"
        className="mt-[var(--space-lg)] flex items-center justify-center gap-[var(--space-xs)] rounded-lg bg-primary py-[var(--space-sm)] font-bold text-white"
      >
        Change Plan <ArrowRight size={16} strokeWidth={2.25} />
      </Link>
    </div>
  );
}
