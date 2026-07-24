"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Puzzle,
  Users,
} from "lucide-react";
import { ReactNode, useEffect, useState } from "react";

import { BrandIcon } from "@/components/icons/BrandIcon";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useLogout } from "@/store/useLogout";
import { getMyQBConnections, getQuickBooksStatus } from "@/store/quickBooks/quickBooksApi";

interface QBConnection {
  _id: string;
  name: string;
  realmId: string;
  role: string;
  createdAt: string;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/quickbooks", label: "QuickBooks", icon: null },
  { href: "/team", label: "Team", icon: Users },
  { href: "/accounting-software", label: "Accounting Software", icon: Puzzle },
  { href: "/subscription", label: "Subscription", icon: CreditCard },
] as const;

// Genuinely new information architecture, not a port of an existing mobile
// pattern — MainTabNavigator is a single-screen stack despite its name, so
// mobile has no real persistent nav to draw from here. See ASSUMPTIONS.md.
export function AppShell({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const logout = useLogout();

  const user = useAppSelector((state) => state.auth.user);
  const accessToken: string | undefined = user?.data?.accessToken;
  const qbConnectionId = useAppSelector((state) => state.quickBooks.qbConnectionId);

  const [connections, setConnections] = useState<QBConnection[]>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      const result = await dispatch(getMyQBConnections({ accessToken }));
      if (getMyQBConnections.fulfilled.match(result)) {
        setConnections(result.payload?.data?.connections ?? []);
      }
    })();
  }, [accessToken, dispatch]);

  const activeConnection = connections.find((c) => c._id === qbConnectionId) || connections[0];

  const handleSwitch = async (connection: QBConnection) => {
    setSwitcherOpen(false);
    if (!accessToken || connection._id === qbConnectionId) return;
    await dispatch(getQuickBooksStatus({ accessToken, qbConnectionId: connection._id }));
  };

  const name = user?.data?.user?.firstName || user?.data?.user?.email?.split("@")[0] || "Account";

  return (
    <div className="flex min-h-screen bg-background-alt">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-white">
        <div className="flex h-16 items-center px-[var(--space-lg)]">
          <span className="text-h3 font-bold text-trust-navy">Scantrix</span>
        </div>

        {connections.length > 0 && (
          <div className="relative mx-[var(--space-md)] mb-[var(--space-sm)]">
            <button
              type="button"
              onClick={() => setSwitcherOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-md border border-border bg-background-soft px-[var(--space-sm)] py-[var(--space-xs)] text-left text-body-sm"
            >
              <span className="truncate font-semibold text-text-primary">{activeConnection?.name ?? "Select company"}</span>
              <ChevronDown size={16} className="shrink-0 text-text-secondary" />
            </button>
            {switcherOpen && (
              <div className="absolute left-0 right-0 top-full z-10 mt-[var(--space-xs)] rounded-md border border-border bg-white shadow-sm">
                {connections.map((connection) => (
                  <button
                    key={connection._id}
                    type="button"
                    onClick={() => handleSwitch(connection)}
                    className={`block w-full truncate px-[var(--space-sm)] py-[var(--space-xs)] text-left text-body-sm ${
                      connection._id === qbConnectionId ? "font-bold text-primary" : "text-text-primary"
                    }`}
                  >
                    {connection.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <nav className="flex flex-1 flex-col gap-[var(--space-xs)] px-[var(--space-sm)]">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-[var(--space-sm)] rounded-md px-[var(--space-md)] py-[var(--space-sm)] text-body-sm font-semibold ${
                  active ? "bg-primary/10 text-primary" : "text-text-secondary hover:bg-background-alt"
                }`}
              >
                {Icon ? (
                  <Icon size={18} strokeWidth={2} className="shrink-0" />
                ) : (
                  <BrandIcon name="quickbooks" size={18} className="shrink-0" />
                )}
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-[var(--space-md)]">
          <Link
            href="/profile"
            className={`mb-[var(--space-xs)] block truncate rounded-md px-[var(--space-sm)] py-[var(--space-xs)] text-body-sm font-semibold ${
              pathname === "/profile" ? "bg-primary/10 text-primary" : "text-text-primary hover:bg-background-alt"
            }`}
          >
            {name}
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-[var(--space-sm)] rounded-md px-[var(--space-sm)] py-[var(--space-xs)] text-left text-body-sm font-semibold text-error hover:bg-error/10"
          >
            <LogOut size={16} strokeWidth={2} className="shrink-0" />
            Logout
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
