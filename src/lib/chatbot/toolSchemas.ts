// OpenAI function-calling schemas for the tools in ./tools.ts. Kept as a
// separate file from the implementations so the "what can the model ask
// for" contract is easy to read/audit on its own — mirrors how
// mcp/mcp-server/src/tools/schemas.ts is split from src/tools/index.ts in
// the sibling project.
import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions";

export const chatToolSchemas: ChatCompletionFunctionTool[] = [
  {
    type: "function",
    function: {
      name: "list_invoices",
      description:
        "List invoices for the signed-in user's currently active QuickBooks company, optionally filtered by status, vendor name, or date range. Use for questions like 'what invoices are pending' or 'show invoices from Acme'.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["pending", "manual", "auto", "failed", "processing"],
            description: "Filter by posted status.",
          },
          vendorName: {
            type: "string",
            description: "Case-insensitive substring match against the vendor name on each invoice.",
          },
          fromDate: { type: "string", description: "ISO date (YYYY-MM-DD). Only invoices on/after this date." },
          toDate: { type: "string", description: "ISO date (YYYY-MM-DD). Only invoices on/before this date." },
          limit: { type: "number", description: "Max invoices to return (capped at 20 regardless of this value)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_invoice_detail",
      description:
        "Get full details for one specific invoice by its id (as returned from list_invoices). Use when the user asks about one particular invoice.",
      parameters: {
        type: "object",
        properties: {
          invoiceId: { type: "string", description: "The invoice's id, from a prior tool result." },
        },
        required: ["invoiceId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_spend",
      description:
        "Compute total spend/counts grouped by vendor, month, or status, already aggregated server-side. ALWAYS use this for any question involving a sum, total, or count of invoices/spend — never add up amounts from list_invoices yourself.",
      parameters: {
        type: "object",
        properties: {
          groupBy: { type: "string", enum: ["vendor", "month", "status"] },
          fromDate: { type: "string", description: "ISO date (YYYY-MM-DD)." },
          toDate: { type: "string", description: "ISO date (YYYY-MM-DD)." },
        },
        required: ["groupBy"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_vendors",
      description: "List vendors for the active QuickBooks company, including their default GL account/tax code.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["active", "inactive"], description: "Defaults to active." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_gl_accounts",
      description: "List the GL (general ledger) accounts configured for the active QuickBooks company.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tax_codes",
      description: "List the tax codes configured for the active QuickBooks company.",
      parameters: { type: "object", properties: {} },
    },
  },
];
