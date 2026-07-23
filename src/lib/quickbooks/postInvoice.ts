// Ported from Scantrix_v2 src/services/quickbooks/postInvoice.ts (branch
// frontend-ui-v2). No RN-specific code — unchanged. Relies on firebase/auth's
// default app already being initialized (see ../firebase/config.ts), so that
// module must be imported somewhere during app startup. Hardcoded host moved
// to NEXT_PUBLIC_QUICKBOOKS_API_URL — see .env.local.example.
import { getAuth } from "firebase/auth";

const getApiBaseUrl = () => {
  return (
    process.env.NEXT_PUBLIC_QUICKBOOKS_API_URL ||
    "https://scantrix-api-4bvpc76k6q-uc.a.run.app"
  );
};

const cleanAmount = (value: any) => {
  const cleaned = String(value || "")
    .replace(/[^0-9.-]/g, "")
    .trim();

  const amount = Number(cleaned);

  return Number.isFinite(amount) ? amount : 0;
};

export const postToQuickBooks = async (invoice: any) => {
  try {
    const url = `${getApiBaseUrl()}/quickbooks/bills`;

    // ✅ FIX: get UID from Firebase auth
    const auth = getAuth();
    const uid = auth.currentUser?.uid;

    if (!uid) {
      throw new Error("User not logged in. UID missing.");
    }

    const body = {
      uid, // ✅ FIXED HERE

      vendorName: invoice.vendorName || "",
      invoiceNumber: invoice.invoiceNumber || "",
      invoiceDate: invoice.invoiceDate || "",
      dueDate: invoice.dueDate || "",
      amountBeforeTax: cleanAmount(invoice.amountBeforeTax),
      taxAmount: cleanAmount(invoice.taxAmount),
      totalAfterTax: cleanAmount(invoice.totalAfterTax),
      currency: invoice.currency || "",
      category: invoice.category || "",
      taxType: invoice.taxType || "",
      vendorAddress: invoice.vendorAddress || "",
      vendorBankDetails: invoice.vendorBankDetails || "",
      itemDescriptions: Array.isArray(invoice.itemDescriptions)
        ? invoice.itemDescriptions
        : [],
      confidenceScore: invoice.confidenceScore || 0,

      // file data
      fileUrl: invoice.fileUrl || invoice.downloadURL || "",
      fileName: invoice.fileName || "invoice.pdf",
      mimeType: invoice.mimeType || "application/pdf",
      storagePath: invoice.storagePath || "",
    };

    console.log("Posting invoice to backend QuickBooks API:", body);

    console.log("🔍 FILE DEBUG (FRONTEND):", {
      fileUrl: body.fileUrl,
      fileName: body.fileName,
      mimeType: body.mimeType,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok || data?.success === false) {
      console.log("QuickBooks backend error:", data);
      throw new Error(data?.message || "QuickBooks API failed");
    }

    console.log("QuickBooks backend success:", data);

    return data;
  } catch (error) {
    console.log("QB Post Error:", error);
    throw error;
  }
};
