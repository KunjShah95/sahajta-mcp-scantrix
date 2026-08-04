import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import axios from "axios";
import FormData from "form-data";
import { unwrapList, unwrapOne, getPagination } from "./unwrap.js";
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
/**
 * The MCP client (Claude) rejects large string arguments before they ever
 * reach this server, so inline base64 only works for trivially small files.
 * Anything realistic must arrive via fileUrl or the browser upload page.
 */
export const MAX_INLINE_BASE64_BYTES = 8 * 1024;
const MIME_BY_EXT = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    heic: "image/heic",
    tif: "image/tiff",
    tiff: "image/tiff",
};
const mimeFromName = (name) => {
    const ext = basename(name).split(".").pop()?.toLowerCase() ?? "";
    return MIME_BY_EXT[ext] ?? "application/octet-stream";
};
/**
 * Reject URLs that point back at the deployment's own network. The server
 * fetches whatever URL it is handed, so without this a caller could use the
 * connector as a proxy to read cloud metadata endpoints or internal services.
 */
const assertFetchableUrl = (raw) => {
    let url;
    try {
        url = new URL(raw);
    }
    catch {
        throw new Error(`fileUrl is not a valid URL: ${raw}`);
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("fileUrl must be an http(s) URL.");
    }
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const blocked = host === "localhost" ||
        host === "::1" ||
        host.endsWith(".localhost") ||
        host.endsWith(".internal") ||
        /^127\./.test(host) ||
        /^10\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
        /^169\.254\./.test(host) ||
        /^0\./.test(host) ||
        /^f[cd][0-9a-f]{2}:/.test(host);
    if (blocked) {
        throw new Error("fileUrl must point at a public host.");
    }
    return url;
};
const decodeBase64 = (raw) => {
    const encoded = raw.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
        throw new Error("fileBase64 is not valid base64 data.");
    }
    return Buffer.from(encoded, "base64");
};
const fileNameFromUrl = (url) => {
    const last = url.pathname.split("/").filter(Boolean).pop();
    return last && /\.[a-z0-9]{2,5}$/i.test(last) ? decodeURIComponent(last) : "invoice.pdf";
};
/** Turn any accepted input shape into bytes, enforcing "exactly one source". */
export const resolveUploadSource = async (input) => {
    const provided = ["fileUrl", "filePath", "fileBase64"].filter((k) => typeof input[k] === "string" && input[k].trim() !== "");
    if (provided.length === 0) {
        throw new Error("No file provided. Pass fileUrl (recommended for a remote connector), or call savetrix_invoice_upload_link to get a browser upload link.");
    }
    if (provided.length > 1) {
        throw new Error(`Pass only one of fileUrl, filePath, or fileBase64 — got ${provided.join(", ")}.`);
    }
    if (input.fileUrl) {
        const url = assertFetchableUrl(input.fileUrl);
        const res = await axios.get(url.toString(), {
            responseType: "arraybuffer",
            timeout: 30000,
            maxContentLength: MAX_UPLOAD_BYTES,
            maxBodyLength: MAX_UPLOAD_BYTES,
            // Don't follow a public URL into a redirect chain that lands somewhere
            // internal; one hop is enough for normal share links.
            maxRedirects: 3,
        });
        const bytes = Buffer.from(res.data);
        if (bytes.length === 0)
            throw new Error(`fileUrl returned an empty file: ${input.fileUrl}`);
        const fileName = input.fileName ?? fileNameFromUrl(url);
        const headerType = String(res.headers?.["content-type"] ?? "").split(";")[0].trim();
        return {
            bytes,
            fileName,
            mimeType: input.mimeType ?? (headerType || mimeFromName(fileName)),
        };
    }
    if (input.filePath) {
        const stat = statSync(input.filePath);
        if (!stat.isFile())
            throw new Error(`Not a file: ${input.filePath}`);
        if (stat.size > MAX_UPLOAD_BYTES)
            throw new Error("Invoice files must be 20 MB or smaller.");
        const fileName = input.fileName ?? basename(input.filePath);
        return {
            bytes: readFileSync(input.filePath),
            fileName,
            mimeType: input.mimeType ?? mimeFromName(input.filePath),
        };
    }
    const bytes = decodeBase64(input.fileBase64);
    if (!input.fileName)
        throw new Error("fileName is required when passing fileBase64.");
    if (bytes.length > MAX_INLINE_BASE64_BYTES) {
        throw new Error(`Inline fileBase64 is limited to ${MAX_INLINE_BASE64_BYTES / 1024} KB because the MCP client truncates large tool arguments. ` +
            "Use fileUrl, or call savetrix_invoice_upload_link for a browser upload link.");
    }
    return {
        bytes,
        fileName: basename(input.fileName),
        mimeType: input.mimeType ?? mimeFromName(input.fileName),
    };
};
/** Post already-resolved bytes to the Savetrix API. Used by the upload page too. */
export const uploadInvoiceBytes = async (client, file) => {
    if (file.bytes.length > MAX_UPLOAD_BYTES) {
        throw new Error("Invoice files must be 20 MB or smaller.");
    }
    const form = new FormData();
    form.append("files", file.bytes, {
        filename: file.fileName,
        contentType: file.mimeType,
    });
    const res = await client.api.post("/invoices", form, {
        headers: { ...form.getHeaders() },
    });
    return res.data;
};
export const uploadInvoice = async (client, input) => uploadInvoiceBytes(client, await resolveUploadSource(input));
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
