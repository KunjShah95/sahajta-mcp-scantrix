import Link from "next/link";

// Mock data, ported verbatim from Scantrix_v2 src/screens/subscription/
// SubscriptionStatusScreen.tsx — static, self-contained, no API.
const MOCK_STATUS = {
  planName: "Trial",
  billingLabel: "Free trial",
  nextBillingDate: "Aug 3, 2026",
  slotsUsed: 1,
  slotsTotal: 1,
  statusLabel: "Active",
};

export function SubscriptionStatusContent() {
  return (
    <div className="mx-auto max-w-2xl p-[var(--space-lg)]">
      <h1 className="text-h2 font-bold text-trust-navy">Subscription</h1>

      <div className="mt-[var(--space-lg)] rounded-xl border border-border bg-white p-[var(--space-md)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-caption text-text-secondary">Current plan</p>
            <p className="mt-[var(--space-xs)] text-h1 font-bold text-trust-navy">{MOCK_STATUS.planName}</p>
          </div>
          <span className="flex items-center gap-[var(--space-xs)] rounded-pill bg-success/10 px-[var(--space-sm)] py-[var(--space-xs)]">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <span className="text-caption font-bold text-success">{MOCK_STATUS.statusLabel}</span>
          </span>
        </div>

        <div className="my-[var(--space-md)] h-px bg-border" />

        <div className="flex items-center justify-between py-[var(--space-xs)]">
          <span className="text-body-sm text-text-secondary">Billing</span>
          <span className="text-body-sm font-bold text-text-primary">{MOCK_STATUS.billingLabel}</span>
        </div>
        <div className="flex items-center justify-between py-[var(--space-xs)]">
          <span className="text-body-sm text-text-secondary">Next billing date</span>
          <span className="text-body-sm font-bold text-text-primary">{MOCK_STATUS.nextBillingDate}</span>
        </div>
        <div className="flex items-center justify-between py-[var(--space-xs)]">
          <span className="text-body-sm text-text-secondary">QuickBooks slots</span>
          <span className="text-body-sm font-bold text-text-primary">
            {MOCK_STATUS.slotsUsed} of {MOCK_STATUS.slotsTotal} slots used
          </span>
        </div>
      </div>

      <Link
        href="/plans"
        className="mt-[var(--space-lg)] flex items-center justify-center gap-[var(--space-xs)] rounded-lg bg-primary py-[var(--space-sm)] font-bold text-white"
      >
        Change Plan &rarr;
      </Link>
    </div>
  );
}
