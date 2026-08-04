import { z } from "zod";
export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});
export const confirmSchema = z.object({ confirm: z.boolean() });
export const updateProfileSchema = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
});
export const invoiceListSchema = z.object({
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(100),
    status: z.enum(["pending", "manual", "auto", "failed"]).optional(),
});
export const invoiceIdSchema = z.object({ invoiceId: z.string().min(1) });
// MUST stay a flat z.object with every field optional. A z.union here
// serializes to a top-level `anyOf`, which is illegal for an MCP/Anthropic
// tool input_schema ("must have type 'object' and not have oneOf/anyOf/allOf
// at the top level"). The SDK does not reject it — it silently emits
// `{"type":"object","properties":{}}`, i.e. a tool Claude sees as taking NO
// arguments at all. That is exactly how remote uploads broke. Which fields
// are required depends on the source, so that is enforced at runtime in
// resolveUploadSource() instead of in the schema.
export const invoiceUploadSchema = z.object({
    fileUrl: z
        .string()
        .min(1)
        .optional()
        .describe("Public https:// URL of the invoice. The server downloads it — best option for a remote connector."),
    filePath: z
        .string()
        .min(1)
        .optional()
        .describe("Absolute path on the machine running the server. Local/stdio installs only; never valid for a remote connector."),
    fileBase64: z
        .string()
        .min(1)
        .optional()
        .describe("Base64 file bytes. Only for very small files (<8 KB); larger payloads are rejected by the MCP client before they reach the server."),
    fileName: z.string().min(1).optional().describe("File name, e.g. invoice.pdf. Required with fileBase64."),
    mimeType: z.string().min(1).optional().describe("Overrides the content type guessed from the file extension."),
});
export const lineItemSchema = z.object({
    description: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    amount: z.number(),
    glAccountId: z.string().optional(),
});
export const extractedDataSchema = z.object({
    vendorName: z.string().optional(),
    currency: z.string().optional(),
    invoiceNumber: z.string().optional(),
    invoiceDate: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    amountBeforeTax: z.number().optional(),
    taxAmount: z.number().optional(),
    totalAmount: z.number().optional(),
    glAccountId: z.string().nullable().optional(),
    taxCodeId: z.string().nullable().optional(),
    lineItems: z.array(lineItemSchema).optional(),
    description: z.string().nullable().optional(),
    vendorAddress: z.string().nullable().optional(),
    bankingDetails: z.string().nullable().optional(),
});
export const invoiceUpdateSchema = z.object({
    invoiceId: z.string().min(1),
    extractedData: extractedDataSchema,
});
export const postToQbSchema = z.object({
    invoiceId: z.string().min(1),
    vendorId: z.string().min(1),
    extractedData: extractedDataSchema,
    confirm: z.boolean(),
});
export const rejectInvoiceSchema = z.object({
    invoiceId: z.string().min(1),
    reason: z.string().optional(),
    confirm: z.boolean(),
});
export const vendorListSchema = z.object({
    status: z.enum(["active", "inactive"]).default("active"),
});
export const vendorCreateSchema = z.object({
    displayName: z.string().min(1),
    currency: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    glAccountId: z.string().optional(),
    taxCodeId: z.string().optional(),
});
export const vendorUpdateSchema = z.object({
    vendorId: z.string().min(1),
    displayName: z.string().optional(),
    currency: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    glAccountId: z.string().optional(),
    taxCodeId: z.string().optional(),
});
export const vendorIdSchema = z.object({ vendorId: z.string().min(1) });
export const deactivateVendorSchema = z.object({ vendorId: z.string().min(1), confirm: z.boolean() });
export const accountCreateSchema = z.object({
    name: z.string().min(1),
    accountType: z.string().min(1),
    accountSubType: z.string().optional(),
});
export const setActiveSchema = z.object({ qbConnectionId: z.string().min(1) });
export const disconnectSchema = z.object({ qbConnectionId: z.string().min(1), confirm: z.boolean() });
export const connectSchema = z.object({ redirectAfter: z.string().optional() });
export const inviteMemberSchema = z.object({
    email: z.string().email(),
    role: z.enum(["admin", "accountant", "contributor"]),
});
export const removeMemberSchema = z.object({ memberId: z.string().min(1), confirm: z.boolean() });
export const choosePlanSchema = z.object({
    plan: z.enum(["standard", "enterprise"]),
    billingInterval: z.enum(["monthly", "yearly"]),
    confirm: z.boolean(),
});
