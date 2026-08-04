import { createReadStream, statSync } from "node:fs";
import { basename } from "node:path";
import FormData from "form-data";
import { unwrapList, unwrapOne, getPagination } from "./unwrap.js";
const MIME_BY_EXT = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
};
const mimeFromPath = (filePath) => {
    const ext = basename(filePath).split(".").pop()?.toLowerCase() ?? "";
    return MIME_BY_EXT[ext] ?? "application/octet-stream";
};
export const uploadInvoice = async (client, filePath) => {
    const stat = statSync(filePath);
    if (!stat.isFile())
        throw new Error(`Not a file: ${filePath}`);
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
export const listInvoices = async (client, args) => {
    const res = await client.api.get("/invoices", {
        params: { page: args.page ?? 1, limit: args.limit ?? 100, ...(args.status ? { status: args.status } : {}) },
    });
    return { invoices: unwrapList(res, ["invoices"]), pagination: getPagination(res) };
};
export const getInvoice = async (client, invoiceId) => {
    const res = await client.api.get(`/invoices/${invoiceId}`);
    return unwrapOne(res, ["invoice"]);
};
export const updateInvoiceExtractedData = async (client, args) => {
    const res = await client.api.patch(`/invoices/${args.invoiceId}`, {
        extractedData: args.extractedData,
    });
    return res.data;
};
export const postInvoiceToQuickBooks = async (client, args) => {
    const res = await client.api.patch(`/invoices/${args.invoiceId}`, {
        vendorId: args.vendorId,
        postedStatus: "manual",
        extractedData: args.extractedData,
    });
    return res.data;
};
export const rejectInvoice = async (client, args) => {
    const res = await client.api.patch(`/invoices/${args.invoiceId}`, {
        postedStatus: "failed",
        ...(args.reason ? { reason: args.reason } : {}),
    });
    return res.data;
};
