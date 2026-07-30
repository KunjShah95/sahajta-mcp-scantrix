"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { useState } from "react";

import { Spinner } from "@/components/ui/Spinner";

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
    <div className="flex h-screen flex-col bg-black">
      <div className="flex h-[60px] shrink-0 items-center justify-between bg-[#1F2937] px-[var(--space-md)]">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close preview"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white"
        >
          <X size={20} strokeWidth={2.25} />
        </button>
        <h1 className="text-body font-bold text-white">Invoice Preview</h1>
        <span className="w-10" />
      </div>

      {/* relative + flex-1 on a h-screen ancestor gives this a definite
          height, which the iframe/img below need to resolve h-full against —
          without it an iframe collapses to the browser's ~150px default. The
          spinner is absolutely positioned over that same box instead of
          taking its own flex slot, so it overlays the content area instead
          of splitting it in half while loading. */}
      <div className="relative flex-1 overflow-auto">
        {loading && url && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-[var(--space-sm)]">
            <Spinner size="lg" tone="white" />
            <p className="text-body-sm font-medium text-white">Loading preview...</p>
          </div>
        )}

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
