import { createReadStream, statSync } from "node:fs";
import { basename } from "node:path";
import FormData from "form-data";
import type { SavetrixClient } from "./savetrixClient.js";
import { unwrapList, unwrapOne, getPagination } from "./unwrap.js";
import type { ExtractedData } from "../types.js";

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const mimeFromPath = (filePath: string): string => {
  const ext = basename(filePath).split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
};

export const uploadInvoice = async (
  client: SavetrixClient,
  filePath: string,
): Promise<unknown> => {
  const stat = statSync(filePath);
  if (!stat.isFile()) throw new Error(`Not a file: ${filePath}`);
  const form = new FormData();
  form.append("files", createReadStream(filePath), {
    filename: basename(filePath),
    contentType: mimeFromPath(filePath),
  });
  const res = await client.api.post("/invoices", form, {
    headers: { ...form.getHeaders() },
  });
  return res.data;
};

export const listInvoices = async (
  client: SavetrixClient,
  args: { page?: number; limit?: number; status?: string },
): Promise<unknown> => {
  const res = await client.api.get("/invoices", {
    params: { page: args.page ?? 1, limit: args.limit ?? 100, ...(args.status ? { status: args.status } : {}) },
  });
  return { invoices: unwrapList(res, ["invoices"]), pagination: getPagination(res) };
};

export const getInvoice = async (
  client: SavetrixClient,
  invoiceId: string,
): Promise<unknown> => {
  const res = await client.api.get(`/invoices/${invoiceId}`);
  return unwrapOne(res, ["invoice"]);
};

export const updateInvoiceExtractedData = async (
  client: SavetrixClient,
  args: { invoiceId: string; extractedData: Partial<ExtractedData> },
): Promise<unknown> => {
  const res = await client.api.patch(`/invoices/${args.invoiceId}`, {
    extractedData: args.extractedData,
  });
  return res.data;
};

export const postInvoiceToQuickBooks = async (
  client: SavetrixClient,
  args: { invoiceId: string; vendorId: string; extractedData: Partial<ExtractedData> },
): Promise<unknown> => {
  const res = await client.api.patch(`/invoices/${args.invoiceId}`, {
    vendorId: args.vendorId,
    postedStatus: "manual",
    extractedData: args.extractedData,
  });
  return res.data;
};

export const rejectInvoice = async (
  client: SavetrixClient,
  args: { invoiceId: string; reason?: string },
): Promise<unknown> => {
  const res = await client.api.patch(`/invoices/${args.invoiceId}`, {
    postedStatus: "failed",
    ...(args.reason ? { reason: args.reason } : {}),
  });
  return res.data;
};
