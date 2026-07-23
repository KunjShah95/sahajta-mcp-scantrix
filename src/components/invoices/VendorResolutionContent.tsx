"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { getInvoiceDetails } from "@/store/invoice/invoiceApi";
import {
  createQuickBooksVendor,
  fetchQuickBooksAccounts,
  fetchQuickBooksTaxCodes,
  fetchQuickBooksVendors,
} from "@/store/quickBooks/quickBooksApi";
import { setSelectedVendor } from "@/store/vendor/vendorSlice";
import { CURRENCY_OPTIONS } from "@/lib/currencies";
import type { TaxCode } from "@/store/quickBooks/quickBooksSlice";

type ActiveTab = "suggested" | "all" | "create";

const taxCodeId = (taxCode: TaxCode) => taxCode.id || taxCode.qbTaxCodeId || taxCode.Id || taxCode._id || "";
const taxCodeName = (taxCode: TaxCode) => taxCode.name || taxCode.Name || taxCodeId(taxCode);

export function VendorResolutionContent({ invoiceId }: { invoiceId: string }) {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const selectedInvoice = useAppSelector((state) => state.invoice.selectedInvoice);
  const vendors = useAppSelector((state) => state.quickBooks.vendors);
  const vendorsLoading = useAppSelector((state) => state.quickBooks.vendorsLoading);
  const glAccounts = useAppSelector((state) => state.quickBooks.accounts);
  const glAccountsLoading = useAppSelector((state) => state.quickBooks.accountsLoading);
  const taxCodes = useAppSelector((state) => state.quickBooks.taxCodes);
  const taxCodesLoading = useAppSelector((state) => state.quickBooks.taxCodesLoading);
  const accessToken = useAppSelector((state) => state.auth.user?.data?.accessToken);

  useEffect(() => {
    dispatch(getInvoiceDetails(invoiceId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  useEffect(() => {
    if (!accessToken) return;
    dispatch(fetchQuickBooksVendors({ accessToken }));
    dispatch(fetchQuickBooksAccounts({ accessToken }));
    dispatch(fetchQuickBooksTaxCodes({ accessToken }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const invoiceVendor =
    selectedInvoice?.extractedData?.vendorName ||
    selectedInvoice?.file?.originalName?.replace(/\.pdf$/i, "")?.replace(/%20/g, " ") ||
    "Unknown Vendor";

  const [activeTab, setActiveTab] = useState<ActiveTab>("suggested");
  const [searchText, setSearchText] = useState("");
  const [newVendorName, setNewVendorName] = useState(invoiceVendor);
  const [currency, setCurrency] = useState(CURRENCY_OPTIONS[0]);
  const [creatingVendor, setCreatingVendor] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [selectedGlAccountId, setSelectedGlAccountId] = useState("");
  const [selectedTaxCodeIdValue, setSelectedTaxCodeIdValue] = useState("");

  useEffect(() => {
    setNewVendorName(invoiceVendor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceVendor]);

  const suggestedVendors = useMemo(() => {
    const lower = invoiceVendor.toLowerCase();
    return vendors.filter((v) => v.displayName?.toLowerCase().includes(lower)).slice(0, 5);
  }, [vendors, invoiceVendor]);

  const filteredVendors = useMemo(() => {
    if (!searchText.trim()) return vendors;
    return vendors.filter((v) => v.displayName?.toLowerCase().includes(searchText.toLowerCase()));
  }, [searchText, vendors]);

  const selectedVendorObj = useMemo(
    () => vendors.find((v) => v._id === selectedVendorId) || null,
    [vendors, selectedVendorId],
  );

  const handleConfirm = () => {
    if (!selectedVendorObj) return;
    dispatch(
      setSelectedVendor({
        _id: selectedVendorObj._id,
        displayName: selectedVendorObj.displayName,
        qbVendorId: selectedVendorObj.qbVendorId,
        email: null,
        phone: null,
        address: null,
      }),
    );
    router.back();
  };

  const handleCreateVendor = async () => {
    if (!newVendorName.trim()) {
      window.alert("Please enter a vendor name.");
      return;
    }
    if (creatingVendor || !accessToken) return;
    setCreatingVendor(true);
    try {
      const result = await dispatch(
        createQuickBooksVendor({
          accessToken,
          displayName: newVendorName.trim(),
          currency,
          glAccountId: selectedGlAccountId,
          taxCodeId: selectedTaxCodeIdValue,
        }),
      );

      if (createQuickBooksVendor.fulfilled.match(result)) {
        const createdPayload = result.payload as Record<string, unknown>;
        const createdVendorData =
          (createdPayload?.data as Record<string, unknown> | undefined)?.vendor ||
          (createdPayload?.data as Record<string, unknown> | undefined)?.Vendor ||
          createdPayload?.vendor ||
          createdPayload?.Vendor ||
          createdPayload?.data ||
          createdPayload ||
          {};
        const created = createdVendorData as Record<string, unknown>;

        dispatch(
          setSelectedVendor({
            _id: (created?._id as string) || "",
            displayName: (created?.displayName as string) || (created?.DisplayName as string) || newVendorName.trim(),
            qbVendorId: (created?.qbVendorId as string) || (created?.Id as string) || "",
            email:
              (created?.email as string) ||
              ((created?.PrimaryEmailAddr as { Address?: string } | undefined)?.Address ?? null),
            phone:
              (created?.phone as string) ||
              ((created?.PrimaryPhone as { FreeFormNumber?: string } | undefined)?.FreeFormNumber ?? null),
            address: (created?.address as string) || null,
          }),
        );

        router.back();
      } else {
        const payload = result.payload as { message?: string } | undefined;
        window.alert(payload?.message || "Failed to create vendor");
      }
    } finally {
      setCreatingVendor(false);
    }
  };

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: "suggested", label: `Suggested (${suggestedVendors.length})` },
    { key: "all", label: "All vendors" },
    { key: "create", label: "Create new" },
  ];

  // NOTE: the ported Vendor type (quickBooksSlice.ts) only carries
  // _id/qbVendorId/displayName/normalizedName — mobile's screen-local Vendor
  // type additionally assumed address/email/phone fields that don't exist on
  // the real ported contract, so this row only ever shows the display name.
  const VendorRow = ({ vendor }: { vendor: { _id: string; displayName: string } }) => {
    const isSelected = selectedVendorId === vendor._id;
    return (
      <button
        type="button"
        onClick={() => setSelectedVendorId((prev) => (prev === vendor._id ? null : vendor._id))}
        className={`flex w-full items-center justify-between rounded-lg border px-[var(--space-md)] py-[var(--space-sm)] text-left ${
          isSelected ? "border-primary bg-primary/5" : "border-border bg-white"
        }`}
      >
        <p className={`min-w-0 flex-1 truncate font-semibold ${isSelected ? "text-primary" : "text-text-primary"}`}>
          {vendor.displayName}
        </p>
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
            isSelected ? "border-primary bg-primary" : "border-border"
          }`}
        >
          {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
        </span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-background-alt pb-28">
      <div className="flex h-14 items-center justify-between bg-primary px-[var(--space-md)]">
        <button type="button" onClick={() => router.back()} className="text-2xl font-semibold text-white">
          ‹
        </button>
        <h1 className="text-body font-bold text-white">Resolve Vendor</h1>
        <span className="w-6" />
      </div>

      <div className="mx-auto max-w-2xl px-[var(--space-md)] pt-[var(--space-md)]">
        <div className="mb-[var(--space-md)] flex items-start gap-[var(--space-sm)] rounded-lg bg-white p-[var(--space-md)] shadow-sm">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background-alt font-bold text-text-secondary">
            ?
          </span>
          <div>
            <p className="text-caption text-text-secondary">Vendor on invoice</p>
            <p className="font-bold text-text-primary">{invoiceVendor}</p>
            <p className="text-caption text-text-secondary">Not found in QuickBooks — select a match or create a new one.</p>
          </div>
        </div>

        <div className="mb-[var(--space-md)] flex gap-[var(--space-xs)] rounded-md bg-white p-[var(--space-xs)] shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-md px-[var(--space-sm)] py-[var(--space-xs)] text-body-sm font-semibold ${
                activeTab === tab.key ? "bg-primary text-white" : "text-text-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "suggested" && (
          <div className="flex flex-col gap-[var(--space-sm)]">
            {vendorsLoading ? (
              <p className="text-center text-body-sm text-text-secondary">Loading vendors…</p>
            ) : suggestedVendors.length === 0 ? (
              <div className="rounded-lg bg-white p-[var(--space-lg)] text-center shadow-sm">
                <p className="font-bold text-text-primary">No close matches found</p>
                <p className="mt-[var(--space-xs)] text-body-sm text-text-secondary">
                  Switch to &quot;All vendors&quot; to browse, or create a new vendor.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className="mt-[var(--space-sm)] font-semibold text-primary"
                >
                  Browse all vendors
                </button>
              </div>
            ) : (
              <>
                <p className="text-caption text-text-secondary">
                  These vendors closely match &quot;{invoiceVendor}&quot;. Tap to select.
                </p>
                {suggestedVendors.map((vendor) => (
                  <VendorRow key={vendor._id} vendor={vendor} />
                ))}
              </>
            )}
          </div>
        )}

        {activeTab === "all" && (
          <div className="flex flex-col gap-[var(--space-sm)]">
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search by name, address or email…"
              className="h-11 rounded-md border border-border bg-white px-[var(--space-md)] text-body focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {vendorsLoading ? (
              <p className="text-center text-body-sm text-text-secondary">Loading vendors…</p>
            ) : filteredVendors.length === 0 ? (
              <div className="rounded-lg bg-white p-[var(--space-lg)] text-center shadow-sm">
                <p className="font-bold text-text-primary">No results</p>
                <p className="mt-[var(--space-xs)] text-body-sm text-text-secondary">
                  Try a different search term, or create a new vendor.
                </p>
              </div>
            ) : (
              <>
                <p className="text-caption text-text-secondary">
                  {filteredVendors.length} vendor{filteredVendors.length !== 1 ? "s" : ""}
                  {searchText.trim() ? " matched" : " total"}
                </p>
                {filteredVendors.map((vendor) => (
                  <VendorRow key={vendor._id} vendor={vendor} />
                ))}
              </>
            )}
          </div>
        )}

        {activeTab === "create" && (
          <div className="flex flex-col gap-[var(--space-md)] rounded-lg bg-white p-[var(--space-md)] shadow-sm">
            <div>
              <h2 className="font-bold text-text-primary">Create a new vendor</h2>
              <p className="text-body-sm text-text-secondary">This will add the vendor directly to your QuickBooks account.</p>
            </div>

            <div>
              <label className="text-body-sm font-semibold text-trust-navy">Vendor name *</label>
              <input
                value={newVendorName}
                onChange={(e) => setNewVendorName(e.target.value)}
                placeholder="Enter vendor name"
                className="mt-[var(--space-xs)] h-11 w-full rounded-md border border-border px-[var(--space-md)] text-body focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="text-body-sm font-semibold text-trust-navy">Currency *</label>
              <select
                value={currency}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setCurrency(e.target.value)}
                className="mt-[var(--space-xs)] h-11 w-full rounded-md border border-border px-[var(--space-md)] text-body focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {CURRENCY_OPTIONS.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-body-sm font-semibold text-trust-navy">GL account</label>
              <select
                value={selectedGlAccountId}
                onChange={(e) => setSelectedGlAccountId(e.target.value)}
                className="mt-[var(--space-xs)] h-11 w-full rounded-md border border-border px-[var(--space-md)] text-body focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">{glAccountsLoading ? "Loading accounts…" : "Select GL account (optional)"}</option>
                {glAccounts.map((account) => (
                  <option key={account._id} value={account.qbAccountId}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-body-sm font-semibold text-trust-navy">Tax code</label>
              <select
                value={selectedTaxCodeIdValue}
                onChange={(e) => setSelectedTaxCodeIdValue(e.target.value)}
                className="mt-[var(--space-xs)] h-11 w-full rounded-md border border-border px-[var(--space-md)] text-body focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">{taxCodesLoading ? "Loading tax codes…" : "Select tax code (optional)"}</option>
                {taxCodes.map((code) => (
                  <option key={taxCodeId(code)} value={taxCodeId(code)}>
                    {taxCodeName(code)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleCreateVendor}
              disabled={creatingVendor}
              className="h-12 rounded-md bg-primary font-bold text-white disabled:opacity-60"
            >
              {creatingVendor ? "Creating…" : "Create vendor"}
            </button>
          </div>
        )}
      </div>

      {selectedVendorObj && activeTab !== "create" && (
        <div className="fixed bottom-0 left-0 right-0 flex items-center justify-between gap-[var(--space-md)] border-t border-border bg-white px-[var(--space-md)] py-[var(--space-sm)]">
          <div className="min-w-0">
            <p className="text-caption text-text-secondary">Selected vendor</p>
            <p className="truncate font-bold text-text-primary">{selectedVendorObj.displayName}</p>
          </div>
          <button
            type="button"
            onClick={handleConfirm}
            className="shrink-0 rounded-md bg-primary px-[var(--space-lg)] py-[var(--space-sm)] font-bold text-white"
          >
            Use this vendor
          </button>
        </div>
      )}
    </div>
  );
}
