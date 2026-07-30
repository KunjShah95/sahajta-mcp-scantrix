"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  FileText,
  Landmark,
  LayoutDashboard,
  LogOut,
  Puzzle,
  Search,
  Store,
  Users,
} from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";

import { BrandIcon } from "@/components/icons/BrandIcon";
import { getSidebarPinned, setSidebarPinned } from "@/lib/storage";
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
  { href: "/accounting-software", label: "Integrations", icon: Puzzle },
  { href: "/subscription", label: "Subscription", icon: CreditCard },
] as const;

// Floating label that appears next to a single icon on hover, instead of
// widening the whole rail — keeps every other row untouched while you're
// pointed at one of them. Only used while the sidebar isn't pinned open,
// since a pinned sidebar already shows the label inline.
const TOOLTIP_CLASS =
  "pointer-events-none absolute left-full top-1/2 z-20 ml-[var(--space-sm)] -translate-y-1/2 whitespace-nowrap rounded-md bg-trust-navy px-[var(--space-sm)] py-[var(--space-xs)] text-body-sm font-semibold text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100";

function greetingFor(name: string): string {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 18) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}

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
  const [pinned, setPinned] = useState(false);
  const collapsed = !pinned;
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
  // (always-collapsed) markup exactly, or React throws a hydration
  // mismatch. Same typeof-window-guarded pattern as every other
  // localStorage call in this codebase (src/lib/storage.ts).
  useEffect(() => {
    setPinned(getSidebarPinned());
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

  const togglePinned = () => {
    setPinned((prev) => {
      const next = !prev;
      setSidebarPinned(next);
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
    <div className="flex h-screen bg-background-alt">
      <aside
        className={`flex h-screen shrink-0 flex-col border-r border-primary-800 bg-primary-900 transition-[width] duration-200 ease-in-out ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <div className={`flex h-16 shrink-0 items-center ${collapsed ? "justify-center" : "px-[var(--space-lg)]"}`}>
          <Link
            href="/dashboard"
            aria-label="Go to dashboard"
            className="group relative flex min-w-0 items-center gap-[var(--space-sm)]"
          >
            <Image src="/scantrix-icon.png" alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-md" />
            {collapsed ? (
              <span className={TOOLTIP_CLASS}>Scantrix</span>
            ) : (
              <span className="truncate text-h3 font-bold text-white">Scantrix</span>
            )}
          </Link>
        </div>

        <nav className={`flex flex-1 flex-col gap-[var(--space-xs)] ${collapsed ? "px-[var(--space-xs)]" : "px-[var(--space-sm)] overflow-y-auto"}`}>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            // Active fill is bright teal (primary-500) — white text on it measures
            // under 3:1 (same finding as Button's primary variant, see
            // DESIGN_ASSUMPTIONS.md D2.3), so it uses dark text-text-primary instead.
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className={`group relative flex items-center gap-[var(--space-sm)] rounded-md py-[var(--space-sm)] text-body-sm font-semibold ${
                  collapsed ? "justify-center" : "px-[var(--space-md)]"
                } ${active ? "bg-primary-500 text-text-primary" : "text-primary-100 hover:bg-white/10 hover:text-white"}`}
              >
                {Icon ? (
                  <Icon size={18} strokeWidth={2} className="shrink-0" />
                ) : (
                  <BrandIcon name="quickbooks" size={18} className="shrink-0" monochrome />
                )}
                {collapsed ? (
                  <span className={TOOLTIP_CLASS}>{item.label}</span>
                ) : (
                  <span className="truncate">{item.label}</span>
                )}
              </Link>
            );
          })}

          {/* Manual pin toggle, right after Subscription — the rest of the
              sidebar already expands per-row on hover, but some users want
              it pinned open (or closed) instead of relying on that. */}
          <button
            type="button"
            onClick={togglePinned}
            aria-label={collapsed ? "Pin sidebar open" : "Collapse sidebar"}
            className={`group relative flex items-center gap-[var(--space-sm)] rounded-md py-[var(--space-sm)] text-body-sm font-semibold text-primary-100 hover:bg-white/10 hover:text-white ${
              collapsed ? "justify-center" : "px-[var(--space-md)]"
            }`}
          >
            {collapsed ? (
              <ChevronsRight size={18} strokeWidth={2} className="shrink-0" />
            ) : (
              <ChevronsLeft size={18} strokeWidth={2} className="shrink-0" />
            )}
            {collapsed ? (
              <span className={TOOLTIP_CLASS}>Pin sidebar open</span>
            ) : (
              <span className="truncate">Collapse sidebar</span>
            )}
          </button>
        </nav>

        <div className={`shrink-0 border-t border-primary-800 ${collapsed ? "p-[var(--space-xs)]" : "p-[var(--space-md)]"}`}>
          <Link
            href="/profile"
            aria-label={name}
            className={`group relative mb-[var(--space-xs)] flex items-center gap-[var(--space-sm)] truncate rounded-md py-[var(--space-xs)] text-body-sm font-semibold ${
              collapsed ? "justify-center" : "px-[var(--space-sm)]"
            } ${pathname === "/profile" ? "bg-primary-500 text-text-primary" : "text-primary-100 hover:bg-white/10 hover:text-white"}`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-400 text-caption font-bold text-primary-900">
              {name.charAt(0).toUpperCase()}
            </span>
            {collapsed ? <span className={TOOLTIP_CLASS}>{name}</span> : name}
          </Link>
          {/* Same near-black sidebar fill as everywhere else in this rail, so
              logout keeps the light text-primary-100 treatment rather than
              text-error — dark red on near-black falls under 4.5:1 (~3.6:1). */}
          <button
            type="button"
            onClick={logout}
            aria-label="Logout"
            className={`flex w-full items-center gap-[var(--space-sm)] rounded-md py-[var(--space-xs)] text-left text-body-sm font-semibold text-primary-100 hover:bg-white/10 hover:text-white ${
              collapsed ? "group relative justify-center" : "px-[var(--space-sm)]"
            }`}
          >
            <LogOut size={16} strokeWidth={2} className="shrink-0" />
            {collapsed ? <span className={TOOLTIP_CLASS}>Logout</span> : "Logout"}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-[var(--space-md)] border-b border-border bg-white px-[var(--space-lg)]">
          {connections.length > 0 && (
            <div ref={switcherRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setSwitcherOpen((v) => !v)}
                aria-expanded={switcherOpen}
                className="flex items-center gap-[var(--space-sm)] rounded-md border border-border bg-background-soft px-[var(--space-sm)] py-[var(--space-xs)] text-left text-body-sm"
              >
                <span className="truncate font-semibold text-text-primary">{activeConnection?.name ?? "Select company"}</span>
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-text-secondary transition-transform ${switcherOpen ? "rotate-180" : ""}`}
                />
              </button>
              {switcherOpen && (
                <div className="absolute left-0 top-full z-10 mt-[var(--space-xs)] w-64 rounded-lg border border-border bg-white p-[var(--space-xs)] shadow-md">
                  {connections.map((connection) => {
                    const isActive = connection._id === qbConnectionId;
                    return (
                      <button
                        key={connection._id}
                        type="button"
                        onClick={() => handleSwitch(connection)}
                        className={`flex w-full items-center gap-[var(--space-sm)] rounded-md px-[var(--space-sm)] py-[var(--space-sm)] text-left text-body-sm ${
                          isActive ? "bg-primary-50 font-bold text-primary-700" : "text-text-primary hover:bg-background-alt"
                        }`}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-caption font-bold text-primary-700">
                          {connection.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{connection.name}</span>
                        {isActive && <Check size={16} strokeWidth={2.5} className="shrink-0 text-primary-600" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <h2 className="min-w-0 flex-1 truncate text-h3 font-bold text-trust-navy">{greetingFor(name)}</h2>

          <div className="flex shrink-0 items-center gap-[var(--space-sm)]">
            <label className="flex w-64 items-center gap-[var(--space-sm)] rounded-pill bg-background-alt px-[var(--space-md)] py-[var(--space-sm)]">
              <Search size={16} strokeWidth={2.25} className="shrink-0 text-text-secondary" />
              <input
                type="text"
                placeholder="Search invoices or vendors"
                className="w-full bg-transparent text-body-sm text-text-primary outline-none placeholder:text-text-secondary"
              />
            </label>

            <button
              type="button"
              aria-label="Notifications"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-text-secondary hover:bg-background-alt"
            >
              <Bell size={18} strokeWidth={2} />
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
