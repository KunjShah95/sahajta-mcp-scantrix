"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

// Ported directly from Scantrix_v2's own
// src/screens/invoice/InvoicePreviewScreen.web.tsx — the mobile source
// already ships a web-specific variant of this exact screen (iframe for
// PDF, img for image), so this is a straight port rather than an
// adaptation from the native react-native-pdf version.
export function InvoicePreviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);

  const url = searchParams.get("url") ?? "";
  const mimeType = searchParams.get("mimeType") ?? "";
  const isPdf = mimeType.includes("pdf") || url.toLowerCase().includes(".pdf");

  return (
    <div className="flex min-h-screen flex-col bg-black">
      <div className="flex h-[60px] items-center justify-between bg-[#1F2937] px-[var(--space-md)]">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-2xl font-semibold text-white"
        >
          ✕
        </button>
        <h1 className="text-body font-bold text-white">Invoice Preview</h1>
        <span className="w-10" />
      </div>

      {loading && url && (
        <div className="flex flex-1 flex-col items-center justify-center gap-[var(--space-sm)]">
          <span aria-hidden className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
          <p className="text-body-sm font-medium text-white">Loading preview...</p>
        </div>
      )}

      <div className="flex-1">
        {url ? (
          isPdf ? (
            <iframe src={url} title="Invoice PDF" className="h-full w-full border-none" onLoad={() => setLoading(false)} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary
            // remote S3 URLs, not a static local asset next/image can optimize.
            <img
              src={url}
              alt="Invoice"
              className="h-full w-full object-contain"
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-body-sm font-medium text-white">Invoice preview is not available.</p>
          </div>
        )}
      </div>
    </div>
  );
}
