// Ported from Scantrix_v2 src/services/storage/uploadInvoice.ts (branch
// frontend-ui-v2). No RN-specific code — only the local firebase config
// import path changed (../../config/firebase -> ./config).
import { storage, auth } from "./config";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  UploadMetadata,
} from "firebase/storage";

export type UploadInvoiceInput = {
  uri: string;
  fileName: string;
  mimeType?: string | null;
};

export type UploadInvoiceResult = {
  storagePath: string;
  downloadURL: string;
  fileName: string;
  mimeType: string;
  size: number;
};

const getSafeFileName = (fileName: string) => {
  return fileName.replace(/[^\w.\-]/g, "_");
};

const guessMimeTypeFromName = (fileName: string) => {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";

  return "application/octet-stream";
};

const uriToBlob = async (uri: string): Promise<Blob> => {
  const response = await fetch(uri);

  if (!response.ok) {
    throw new Error(`Failed to read local file. Status: ${response.status}`);
  }

  return await response.blob();
};

export const uploadInvoice = async ({
  uri,
  fileName,
  mimeType,
}: UploadInvoiceInput): Promise<UploadInvoiceResult> => {
  if (!uri) {
    throw new Error("Missing file uri.");
  }

  if (!fileName) {
    throw new Error("Missing file name.");
  }

  const resolvedMimeType = mimeType || guessMimeTypeFromName(fileName);
  const safeFileName = getSafeFileName(fileName);
  const userId = auth.currentUser?.uid ?? "anonymous";
  const timestamp = Date.now();

  const storagePath = `invoices/${userId}/${timestamp}_${safeFileName}`;
  const fileRef = ref(storage, storagePath);

  const blob = await uriToBlob(uri);

  const metadata: UploadMetadata = {
    contentType: resolvedMimeType,
    customMetadata: {
      originalFileName: fileName,
      uploadedBy: userId,
      uploadedAt: String(timestamp),
    },
  };

  await uploadBytes(fileRef, blob, metadata);
  const downloadURL = await getDownloadURL(fileRef);

  return {
    storagePath,
    downloadURL,
    fileName,
    mimeType: resolvedMimeType,
    size: blob.size,
  };
};
