import { createReadStream, statSync } from "node:fs";
import { basename } from "node:path";
import FormData from "form-data";
import { unwrapList, unwrapOne, getPagination } from "./unwrap.js";
const MAX_INLINE_FILE_BYTES = 20 * 1024 * 1024;
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
export const uploadInvoice = async (client, source) => {
    const form = new FormData();
    if ("filePath" in source) {
        const stat = statSync(source.filePath);
        if (!stat.isFile())
            throw new Error(`Not a file: ${source.filePath}`);
        form.append("files", createReadStream(source.filePath), {
            filename: basename(source.filePath),
            contentType: mimeFromPath(source.filePath),
        });
    }
    else {
        const encoded = source.fileBase64.replace(/^data:[^;]+;base64,/, "");
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
            throw new Error("fileBase64 is not valid base64 data");
        }
        const bytes = Buffer.from(encoded, "base64");
        if (bytes.length > MAX_INLINE_FILE_BYTES) {
            throw new Error("Inline invoice files must be 20 MB or smaller");
        }
        form.append("files", bytes, {
            filename: basename(source.fileName),
            contentType: source.mimeType ?? mimeFromPath(source.fileName),
        });
    }
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
