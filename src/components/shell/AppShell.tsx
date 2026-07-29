"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  CreditCard,
  FileText,
  Landmark,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Puzzle,
  Store,
  Users,
} from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";

import { BrandIcon } from "@/components/icons/BrandIcon";
import { getSidebarCollapsed, setSidebarCollapsed } from "@/lib/storage";
import { capitalizeWords } from "@/lib/textFormat";
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
  { href: "/vendors", label: "Vendors", icon: Store },
  { href: "/gl-tax-codes", label: "GL Account & TaxCode", icon: Landmark },
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
  const [collapsed, setCollapsed] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      const result = await dispatch(getMyQBConnections({ accessToken }));
      if (getMyQBConnections.fulfilled.match(result)) {
        setConnections(result.payload?.data?.connections ?? []);
      }
    })();
  }, [accessToken, dispatch]);

  // Read the persisted preference after mount rather than in useState's
  // initializer — the initial client render must match the server's
  // (always-expanded) markup exactly, or React throws a hydration
  // mismatch. This follows the same typeof-window-guarded pattern as
  // every other localStorage call in this codebase (src/lib/storage.ts)
  // rather than reading window directly here.
  useEffect(() => {
    setCollapsed(getSidebarCollapsed());
  }, []);

  // AppShell is the persistent layout and never remounts between route
  // navigations, so without this the switcher dropdown stays open
  // (rendered on top of whatever page you navigate to) until manually
  // toggled shut again.
  useEffect(() => {
    setSwitcherOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!switcherOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [switcherOpen]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      setSidebarCollapsed(next);
      return next;
    });
  };

  const activeConnection = connections.find((c) => c._id === qbConnectionId) || connections[0];

  const handleSwitch = async (connection: QBConnection) => {
    setSwitcherOpen(false);
    if (!accessToken || connection._id === qbConnectionId) return;
    await dispatch(getQuickBooksStatus({ accessToken, qbConnectionId: connection._id }));
  };

  const name = capitalizeWords(user?.data?.user?.firstName || user?.data?.user?.email?.split("@")[0] || "Account");

  return (
    <div className="flex min-h-screen bg-background-alt">
      <aside
        className={`flex shrink-0 flex-col border-r border-border bg-primary transition-[width] duration-200 ease-in-out ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <div className={`flex h-16 items-center ${collapsed ? "justify-center px-[var(--space-sm)]" : "justify-between px-[var(--space-lg)]"}`}>
          {!collapsed && <span className="truncate text-h3 font-bold text-text-primary">Scantrix</span>}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-primary hover:bg-white/10"
          >
            {collapsed ? <PanelLeftOpen size={18} strokeWidth={2} /> : <PanelLeftClose size={18} strokeWidth={2} />}
          </button>
        </div>

        {connections.length > 0 && !collapsed && (
          <div ref={switcherRef} className="relative mx-[var(--space-md)] mb-[var(--space-sm)]">
            <button
              type="button"
              onClick={() => setSwitcherOpen((v) => !v)}
              aria-expanded={switcherOpen}
              className="flex w-full items-center justify-between rounded-md border border-border bg-background-soft px-[var(--space-sm)] py-[var(--space-xs)] text-left text-body-sm"
            >
              <span className="truncate font-semibold text-text-primary">{activeConnection?.name ?? "Select company"}</span>
              <ChevronDown
                size={16}
                className={`shrink-0 text-text-secondary transition-transform ${switcherOpen ? "rotate-180" : ""}`}
              />
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

        <nav className={`flex flex-1 flex-col gap-[var(--space-xs)] ${collapsed ? "px-[var(--space-xs)]" : "px-[var(--space-sm)]"}`}>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                aria-label={item.label}
                className={`flex items-center gap-[var(--space-sm)] rounded-md py-[var(--space-sm)] text-body-sm font-semibold ${
                  collapsed ? "justify-center px-0" : "px-[var(--space-md)]"
                } ${active ? "bg-white/25 text-text-primary" : "text-text-primary/80 hover:bg-white/10"}`}
              >
                {Icon ? (
                  <Icon size={18} strokeWidth={2} className="shrink-0" />
                ) : (
                  <BrandIcon name="quickbooks" size={18} className="shrink-0" />
                )}
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={`border-t border-border ${collapsed ? "p-[var(--space-xs)]" : "p-[var(--space-md)]"}`}>
          <Link
            href="/profile"
            title={collapsed ? name : undefined}
            aria-label={name}
            className={`mb-[var(--space-xs)] flex items-center gap-[var(--space-sm)] truncate rounded-md py-[var(--space-xs)] text-body-sm font-semibold ${
              collapsed ? "justify-center px-0" : "px-[var(--space-sm)]"
            } ${pathname === "/profile" ? "bg-white/25 text-text-primary" : "text-text-primary hover:bg-white/10"}`}
          >
            {collapsed ? (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-caption font-bold text-text-primary">
                {name.charAt(0).toUpperCase()}
              </span>
            ) : (
              name
            )}
          </Link>
          <button
            type="button"
            onClick={logout}
            title={collapsed ? "Logout" : undefined}
            aria-label="Logout"
            className={`flex w-full items-center gap-[var(--space-sm)] rounded-md py-[var(--space-xs)] text-left text-body-sm font-semibold text-text-primary hover:bg-white/10 ${
              collapsed ? "justify-center px-0" : "px-[var(--space-sm)]"
            }`}
          >
            <LogOut size={16} strokeWidth={2} className="shrink-0" />
            {!collapsed && "Logout"}
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
