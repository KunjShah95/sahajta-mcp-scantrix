"use client";

import Link from "next/link";
import { Check, ChevronRight, Eye } from "lucide-react";
import { useState } from "react";

// Mock data, ported verbatim from Scantrix_v2 src/screens/subscription/
// PlansScreen.tsx — pricing is fixed, not open for reinterpretation (see
// ASSUMPTIONS.md). Pure UI, no real billing calls.
type BillingCycle = "monthly" | "yearly";

interface PlanMock {
  id: "trial" | "standard" | "enterprise";
  name: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  billingNote: string;
  qbSlots: number;
  features: string[];
  highlight?: boolean;
}

const MOCK_PLANS: PlanMock[] = [
  {
    id: "trial",
    name: "Trial",
    tagline: "Try Scantrix free for 14 days",
    priceMonthly: 0,
    priceYearly: 0,
    billingNote: "Free for 14 days",
    qbSlots: 1,
    features: ["Unlimited scans", "Unlimited team members", "1 QuickBooks slot"],
  },
  {
    id: "standard",
    name: "Standard",
    tagline: "For growing teams",
    priceMonthly: 15,
    priceYearly: 149,
    billingNote: "~17% off billed yearly",
    qbSlots: 1,
    features: ["Unlimited scans", "Unlimited team members", "1 QuickBooks slot"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For multi-entity businesses",
    priceMonthly: 30,
    priceYearly: 299,
    billingNote: "~17% off billed yearly",
    qbSlots: 3,
    features: ["Unlimited scans", "Unlimited team members", "3 QuickBooks slots"],
    highlight: true,
  },
];

const CURRENT_PLAN_NAME = "Trial";

function priceLabel(plan: PlanMock, cycle: BillingCycle) {
  if (plan.id === "trial") return "Free";
  return `$${cycle === "monthly" ? plan.priceMonthly : plan.priceYearly}`;
}

function priceSuffix(plan: PlanMock, cycle: BillingCycle) {
  if (plan.id === "trial") return "for 14 days";
  return cycle === "monthly" ? "/mo" : "/yr";
}

export function PlansContent() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  const handleChoosePlan = () => {
    window.alert("Preview only — full subscription flow coming soon.");
  };

  return (
    <div className="mx-auto max-w-2xl p-[var(--space-lg)]">
      <h1 className="text-h2 font-bold text-trust-navy">Choose your plan</h1>
      <p className="mb-[var(--space-md)] mt-[var(--space-xs)] text-body-sm text-text-secondary">
        Pick the plan that fits your team. This is a preview — no payment is collected yet.
      </p>

      <Link
        href="/subscription"
        className="mb-[var(--space-lg)] flex items-center justify-between rounded-lg border border-border bg-background-soft px-[var(--space-md)] py-[var(--space-sm)]"
      >
        <span className="text-body-sm text-text-secondary">
          Current plan: <strong className="font-bold text-trust-navy">{CURRENT_PLAN_NAME}</strong>
        </span>
        <span className="flex items-center gap-[var(--space-xs)] text-caption font-bold text-primary">
          View status <ChevronRight size={14} strokeWidth={2.25} />
        </span>
      </Link>

      <div className="mb-[var(--space-lg)] flex rounded-pill bg-background-soft p-1">
        {(["monthly", "yearly"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCycle(option)}
            className={`flex-1 rounded-pill py-[var(--space-sm)] text-body-sm font-bold capitalize ${
              cycle === option ? "bg-primary text-white" : "text-text-secondary"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-[var(--space-md)]">
        {MOCK_PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-xl border bg-white p-[var(--space-md)] ${
              plan.highlight ? "border-2 border-primary" : "border-border"
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-3 right-[var(--space-md)] rounded-pill bg-primary px-[var(--space-sm)] py-1 text-[10px] font-bold tracking-wide text-white">
                MOST POPULAR
              </span>
            )}

            <p className="text-h3 font-bold text-text-primary">{plan.name}</p>
            <p className="text-caption text-text-secondary">{plan.tagline}</p>

            <div className="mt-[var(--space-sm)] flex items-end gap-1">
              <span className="text-h1 font-bold text-text-primary">{priceLabel(plan, cycle)}</span>
              <span className="mb-1 text-body-sm text-text-secondary">{priceSuffix(plan, cycle)}</span>
            </div>
            {plan.id !== "trial" && cycle === "yearly" && (
              <p className="mt-[var(--space-xs)] text-caption font-semibold text-success">{plan.billingNote}</p>
            )}

            <div className="my-[var(--space-sm)] h-px bg-border" />

            <div className="mb-[var(--space-md)] flex flex-col gap-[var(--space-xs)]">
              {plan.features.map((feature) => (
                <div key={feature} className="flex items-center gap-[var(--space-sm)]">
                  <Check size={16} strokeWidth={2.5} className="shrink-0 text-success" />
                  <span className="text-body-sm text-text-primary">{feature}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleChoosePlan}
              className={`w-full rounded-lg py-[var(--space-sm)] text-body-sm font-bold ${
                plan.highlight ? "bg-primary text-white" : "border border-border bg-background-soft text-text-primary"
              }`}
            >
              Choose Plan
            </button>
          </div>
        ))}

        <Link
          href="/paywall"
          className="mt-[var(--space-xs)] flex items-center justify-center gap-[var(--space-xs)] py-[var(--space-sm)] text-caption font-semibold text-text-secondary"
        >
          <Eye size={14} strokeWidth={2} />
          Preview blocked screen (demo)
        </Link>
      </div>
    </div>
  );
}
