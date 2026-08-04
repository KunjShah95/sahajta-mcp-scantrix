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
export const invoiceUploadSchema = z.object({ filePath: z.string().min(1) });
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
