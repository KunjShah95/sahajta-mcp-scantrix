"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { getInvoices } from "@/store/invoice/invoiceApi";
import { fetchQuickBooksAccounts, fetchQuickBooksTaxCodes, fetchQuickBooksVendors } from "@/store/quickBooks/quickBooksApi";
import { SEARCH_CATEGORY_LABELS, searchAll, type SearchResult, type SearchResultCategory } from "@/lib/globalSearch";

const CATEGORY_ORDER: SearchResultCategory[] = ["invoice", "vendor", "glAccount", "taxCode"];
// Just avoids the dropdown flashing open/closed while the user is still
// mid-word — the filtering itself is synchronous in-memory work either way.
const DEBOUNCE_MS = 150;

export function GlobalSearchBar() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const accessToken = useAppSelector((state) => state.auth.user?.data?.accessToken);
  const qbConnectionId = useAppSelector((state) => state.quickBooks.qbConnectionId);
  const invoices = useAppSelector((state) => state.invoice.invoices);
  const vendors = useAppSelector((state) => state.quickBooks.vendors);
  const accounts = useAppSelector((state) => state.quickBooks.accounts);
  const taxCodes = useAppSelector((state) => state.quickBooks.taxCodes);

  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = setTimeout(() => setQuery(rawQuery), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [rawQuery]);

  // Most pages only load the one or two lists they render (see
  // VendorsContent/GLTaxCodeContent/InvoiceListContent), but the search bar
  // needs all four regardless of which page it's mounted on — so it fetches
  // them itself, gated the same way every other QB-scoped fetch in this app
  // is: on accessToken + qbConnectionId being present.
  useEffect(() => {
    if (!accessToken || !qbConnectionId) return;
    dispatch(getInvoices());
    dispatch(fetchQuickBooksVendors({ accessToken }));
    dispatch(fetchQuickBooksAccounts({ accessToken }));
    dispatch(fetchQuickBooksTaxCodes({ accessToken }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, qbConnectionId]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const groups = useMemo(() => {
    const results = searchAll(query, { invoices, vendors, accounts, taxCodes });
    return CATEGORY_ORDER.map((category) => ({
      category,
      label: SEARCH_CATEGORY_LABELS[category],
      items: results.filter((result) => result.category === category),
    })).filter((group) => group.items.length > 0);
  }, [query, invoices, vendors, accounts, taxCodes]);

  const flatResults = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  useEffect(() => {
    setActiveIndex(flatResults.length > 0 ? 0 : -1);
  }, [flatResults.length, query]);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setRawQuery("");
    setQuery("");
    router.push(result.href);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open || flatResults.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % flatResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + flatResults.length) % flatResults.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const active = flatResults[activeIndex];
      if (active) handleSelect(active);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const showDropdown = open && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative w-64 shrink-0">
      <label className="flex items-center gap-[var(--space-sm)] rounded-pill bg-background-alt px-[var(--space-md)] py-[var(--space-sm)]">
        <Search size={16} strokeWidth={2.25} className="shrink-0 text-text-secondary" />
        <input
          type="text"
          value={rawQuery}
          onChange={(event) => {
            setRawQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search invoices, vendors…"
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          className="w-full bg-transparent text-body-sm text-text-primary outline-none placeholder:text-text-secondary"
        />
      </label>

      {showDropdown && (
        <div className="absolute left-0 top-full z-20 mt-[var(--space-xs)] max-h-96 w-96 overflow-y-auto rounded-lg border border-border bg-white p-[var(--space-xs)] shadow-md">
          {flatResults.length === 0 ? (
            <p className="px-[var(--space-sm)] py-[var(--space-md)] text-center text-body-sm text-text-secondary">
              No matches for &ldquo;{query}&rdquo;
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.category} className="mb-[var(--space-xs)] last:mb-0">
                <p className="px-[var(--space-sm)] py-[var(--space-xs)] text-caption font-bold uppercase tracking-wide text-text-secondary">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const flatIndex = flatResults.indexOf(item);
                  const active = flatIndex === activeIndex;
                  return (
                    <button
                      key={`${item.category}-${item.id}`}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setActiveIndex(flatIndex)}
                      className={`flex w-full flex-col items-start gap-0.5 rounded-md px-[var(--space-sm)] py-[var(--space-sm)] text-left ${
                        active ? "bg-primary-50" : "hover:bg-background-alt"
                      }`}
                    >
                      <span className="w-full truncate text-body-sm font-semibold text-text-primary">{item.title}</span>
                      {item.subtitle && (
                        <span className="w-full truncate text-caption text-text-secondary">{item.subtitle}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
