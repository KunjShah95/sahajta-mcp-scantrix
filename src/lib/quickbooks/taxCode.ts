import type { TaxCode } from "@/store/quickBooks/quickBooksSlice";

// TaxCode's shape varies by environment (see quickBooksSlice.ts) — fall back
// across every field name the live API and older shapes have used.
export const taxCodeId = (taxCode: TaxCode) =>
  taxCode.id || taxCode.qbTaxCodeId || taxCode.Id || taxCode._id || "";

export const taxCodeName = (taxCode: TaxCode) =>
  taxCode.name || taxCode.Name || taxCodeId(taxCode);
