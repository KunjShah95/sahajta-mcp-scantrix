import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SavetrixClient } from "../client/savetrixClient.js";
import { createClient } from "../client/savetrixClient.js";
import type { Config } from "../config.js";
import { requireConfirm } from "./gates.js";
import * as S from "./schemas.js";

import * as authClient from "../client/auth.js";
import * as invoicesClient from "../client/invoices.js";
import * as vendorsClient from "../client/vendors.js";
import * as accountsClient from "../client/accounts.js";
import * as taxcodesClient from "../client/taxcodes.js";
import * as teamClient from "../client/team.js";
import * as quickbooksClient from "../client/quickbooks.js";
import * as subscriptionClient from "../client/subscription.js";

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

const md = (markdown: string) => ({
  content: [{ type: "text" as const, text: markdown }],
});

// When a tool fails because the user is not signed in, or is signed in but has
// no active QuickBooks connection, return an actionable link (the pattern the
// big MCP connectors use) instead of a raw error. Returns markdown or null.
const authGuidance = async (
  client: SavetrixClient,
  error: unknown,
): Promise<string | null> => {
  const msg = error instanceof Error ? error.message : String(error);
  const status = (error as any)?.response?.status as number | undefined;
  const web = client.webUrl;

  // 1. Not signed in.
  if (!client.getAccessToken() || status === 401 || /log ?in|unauthor|token|session expired/i.test(msg)) {
    return [
      "## Sign in required 🔒",
      `1. Open **[${web}](${web}/)** to sign up or reset your password.`,
      "2. Then run **savetrix_login** with your email and password.",
    ].join("\n");
  }

  // 2. Signed in, but no active QuickBooks company connected.
  let qbId: string | undefined;
  try { qbId = await client.resolveQbId(); } catch { /* treat as not connected */ }
  if (!qbId) {
    let url: string | undefined;
    try { url = await quickbooksClient.getConnectUrl(client); } catch { /* fall back to tool */ }
    return [
      "## Connect QuickBooks 🔗",
      "This action needs an active QuickBooks connection.",
      url
        ? `👉 **[Authorize QuickBooks](${url})** in your browser, then run **savetrix_qb_connections**.`
        : "Run **savetrix_qb_connect** to get your authorization link.",
    ].join("\n");
  }

  return null;
};

const withClient =
  (client: SavetrixClient) =>
  <TArgs>(fn: (client: SavetrixClient, args: TArgs) => Promise<unknown>) =>
  async (args: TArgs) => {
    try {
      return text(await fn(client, args));
    } catch (error) {
      const guide = await authGuidance(client, error);
      if (guide) return md(guide);
      return text({
        success: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

export interface ToolHostCapabilities {
  /**
   * Mints a short-lived browser upload link. Only the remote connector can
   * supply this (it needs the public URL + token secret); on a local/stdio
   * install it is undefined and filePath is used instead.
   */
  createUploadLink?: () => Promise<string>;
}

/** Guidance shown whenever a remote upload needs a real transport. */
const uploadHelp = async (host: ToolHostCapabilities): Promise<string> => {
  if (!host.createUploadLink) {
    return [
      "## Can't read that file",
      "This server is running locally, so pass an absolute **filePath** on this machine, or a public **fileUrl**.",
    ].join("\n");
  }
  const link = await host.createUploadLink();
  return [
    "## Upload your invoice 📎",
    "I can't read files from your computer — this connector runs on a server, not on your machine.",
    "",
    "**If you (the model) have a sandboxed shell with outbound network access to this host** (code execution enabled, and this domain allowlisted in the user's Claude settings), you can upload it yourself right now instead of making the user click anything:",
    "```",
    `curl -sS -X POST "${link}" \\`,
    "  -H \"Content-Type: <the file's real mime type, e.g. application/pdf>\" \\",
    "  -H \"X-File-Name: <the original filename>\" \\",
    "  --data-binary @<path to the file in your sandbox>",
    "```",
    "This must be the **raw file bytes as the request body** — not multipart/`-F`, the server reads it as a raw binary body and multipart framing would corrupt it. A response with `\"ok\": true` means it's done — tell the user and move on to listing invoices. If the request errors for any reason (blocked network, expired ticket, anything), don't show the user that error — just fall through to the link below as normal.",
    "",
    `👉 **[Click here to upload your invoice](${link})**`,
    "",
    "Pick the photo or PDF on that page. When it says *Uploaded ✓*, come back and ask me to list your invoices — I'll pick it up from there.",
    "",
    "_Already have the file at a public link? Give me the URL instead and I'll fetch it directly._",
  ].join("\n");
};

export const registerSavetrixTools = (
  server: McpServer,
  client: SavetrixClient,
  host: ToolHostCapabilities = {},
): void => {
  const run = withClient(client);

  // ── Onboarding ────────────────────────────────────────────────────────
  server.registerTool("savetrix_get_started", {
    title: "Get started / sign in",
    description:
      "Show a step-by-step onboarding guide with clickable links to sign in to Savetrix (scantrix.ai) and connect QuickBooks. Call this first if you are not sure whether you are logged in or connected.",
    inputSchema: S.confirmSchema.omit({ confirm: true }),
  }, async () => {
    const loggedIn = Boolean(client.getAccessToken());
    const web = client.webUrl;
    let qbConnected = false;
    let qbUrl: string | undefined;
    if (loggedIn) {
      try {
        const id = await client.resolveQbId();
        qbConnected = Boolean(id);
      } catch { /* ignore */ }
      if (!qbConnected) {
        try {
          qbUrl = await quickbooksClient.getConnectUrl(client);
        } catch { /* surface generic step below */ }
      }
    }

    const step1 = loggedIn
      ? "✅ **Signed in to Savetrix.**"
      : [
          "**1. Sign in to Savetrix**",
          `   • Open **[${web}](${web}/)** to sign in or create an account.`,
          "   • Then log in here by running the **savetrix_login** tool with your email and password.",
        ].join("\n");

    const step2 = !loggedIn
      ? "**2. Connect QuickBooks** — available after you sign in."
      : qbConnected
        ? "✅ **QuickBooks connected.** You can list invoices, vendors, GL accounts, and post bills."
        : [
            "**2. Connect QuickBooks**",
            qbUrl
              ? `   • Open **[Authorize QuickBooks](${qbUrl})** in your browser and approve access.`
              : "   • Run the **savetrix_qb_connect** tool to get your authorization link.",
            "   • After authorizing, run **savetrix_qb_connections** to confirm the company appears.",
          ].join("\n");

    const links = [
      `🌐 Web app: **[${web}](${web}/)**`,
      loggedIn && qbUrl ? `🔗 Connect QuickBooks: **[Authorize](${qbUrl})**` : undefined,
    ].filter(Boolean).join("   ·   ");

    const account = loggedIn
      ? "Signed in. Run **savetrix_logout** to sign out, or **savetrix_login** to switch accounts."
      : "Not signed in. Run **savetrix_login** with your email and password.";

    return md(
      [
        "# Savetrix — Get Started",
        "",
        links,
        "",
        step1,
        "",
        step2,
        "",
        "---",
        `**Account:** ${account}`,
        "Once signed in and connected, try: `savetrix_invoice_list`, `savetrix_vendor_list`, or upload a receipt with `savetrix_invoice_upload`.",
      ].join("\n"),
    );
  });

  // ── Auth / account ────────────────────────────────────────────────────
  server.registerTool("savetrix_login", {
    title: "Login to Savetrix",
    description:
      "Log in to the Savetrix invoice app with email and password. Sign up or reset a password at scantrix.ai. Required before any data operation if SAVETRIX_EMAIL/SAVETRIX_PASSWORD are not configured.",
    inputSchema: S.loginSchema,
  }, async (a) => {
    try {
      const payload = await client.login(a.email, a.password);
      const user = (payload as any)?.data?.user;
      const name = user?.firstName ? ` ${user.firstName}` : "";
      const web = client.webUrl;
      let qbConnected = false;
      let qbUrl: string | undefined;
      try {
        qbConnected = Boolean(await client.resolveQbId());
      } catch { /* ignore */ }
      if (!qbConnected) {
        try { qbUrl = await quickbooksClient.getConnectUrl(client); } catch { /* ignore */ }
      }
      const next = qbConnected
        ? "✅ QuickBooks is connected — try `savetrix_invoice_list` or `savetrix_vendor_list`."
        : [
            "**Next: connect QuickBooks**",
            qbUrl
              ? `👉 **[Authorize QuickBooks](${qbUrl})** in your browser, then run **savetrix_qb_connections**.`
              : "Run **savetrix_qb_connect** to get your authorization link.",
          ].join("\n");
      return md(
        [
          `## Signed in${name} ✅`,
          `Account: **${user?.email ?? a.email}**   ·   Web app: [${web}](${web}/)`,
          "",
          next,
          "",
          "To switch accounts, run **savetrix_logout** then **savetrix_login** again.",
        ].join("\n"),
      );
    } catch (error) {
      return md(
        [
          "## Sign-in failed ❌",
          error instanceof Error ? error.message : String(error),
          "",
          `Check your email/password, or sign up / reset at [${client.webUrl}](${client.webUrl}/).`,
        ].join("\n"),
      );
    }
  });

  server.registerTool("savetrix_logout", {
    title: "Logout",
    description:
      "Sign out of the current Savetrix session and clear stored tokens. Safe to call any time; run savetrix_login to sign back in.",
    inputSchema: S.confirmSchema.omit({ confirm: true }),
  }, async () => {
    try {
      await client.logout();
      const web = client.webUrl;
      return md(
        [
          "## Signed out ✅",
          "Your session and stored tokens were cleared.",
          "",
          `Sign back in with **savetrix_login**, or open [${web}](${web}/).`,
        ].join("\n"),
      );
    } catch (error) {
      return text({
        success: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  server.registerTool("savetrix_account_info", {
    title: "Account info",
    description: "Show which user the server is currently acting as.",
    inputSchema: S.confirmSchema.omit({ confirm: true }),
  }, run((c) => {
    const session = c.session.load();
    const user = (session.user as any)?.data?.user;
    return Promise.resolve({
      loggedIn: Boolean(c.getAccessToken()),
      user: user ?? null,
    });
  }));

  server.registerTool("savetrix_account_update_profile", {
    title: "Update profile",
    description: "Update the logged-in user's firstName, lastName, or phone.",
    inputSchema: S.updateProfileSchema,
  }, run((c, a) => authClient.updateProfile(c, a)));

  // ── Invoices ──────────────────────────────────────────────────────────
  server.registerTool("savetrix_invoice_list", {
    title: "List invoices",
    description: "List invoices for the active QuickBooks connection, with pagination.",
    inputSchema: S.invoiceListSchema,
  }, run((c, a) => invoicesClient.listInvoices(c, a)));

  server.registerTool("savetrix_invoice_get", {
    title: "Get invoice",
    description: "Fetch the full details of a single invoice by its id.",
    inputSchema: S.invoiceIdSchema,
  }, run((c, a) => invoicesClient.getInvoice(c, a.invoiceId)));

  server.registerTool("savetrix_invoice_upload", {
    title: "Upload invoice",
    description:
      "Upload an invoice photo or PDF and have it scanned. Pass exactly one source. " +
      "Prefer fileUrl (a public https link the server downloads itself). " +
      "filePath works only when this server runs on the same machine as the chat client — a remote connector cannot see your filesystem, " +
      "so never pass a path from a chat sandbox (e.g. /mnt/user-data/...). " +
      "fileBase64 is for tiny files only. " +
      "If you have none of those, call this with no arguments (or use savetrix_invoice_upload_link) to get a browser upload link for the user.",
    inputSchema: S.invoiceUploadSchema,
  }, async (a) => {
    const hasSource = Boolean(a.fileUrl || a.filePath || a.fileBase64);
    if (!hasSource) return md(await uploadHelp(host));
    try {
      return text(await invoicesClient.uploadInvoice(client, a));
    } catch (error) {
      const guide = await authGuidance(client, error);
      if (guide) return md(guide);
      // A path that only exists on the chat client's machine is the single most
      // common failure here (ENOENT on /mnt/user-data/uploads/...). Hand back
      // the upload link rather than a bare filesystem error.
      const msg = error instanceof Error ? error.message : String(error);
      if (/ENOENT|no such file|not a file/i.test(msg)) {
        return md(await uploadHelp(host));
      }
      return text({ success: false, message: msg });
    }
  });

  server.registerTool("savetrix_invoice_upload_link", {
    title: "Get an invoice upload link",
    description:
      "Get a short-lived link the user can open in their browser to upload an invoice photo or PDF. " +
      "Use this whenever the user has a file on their own device and this server is remote.",
    inputSchema: S.confirmSchema.omit({ confirm: true }),
  }, async () => md(await uploadHelp(host)));

  server.registerTool("savetrix_invoice_update", {
    title: "Update invoice details",
    description:
      "Patch extracted details on an invoice before posting (e.g. correct vendor, amount, GL account/category, tax code).",
    inputSchema: S.invoiceUpdateSchema,
  }, run((c, a) => invoicesClient.updateInvoiceExtractedData(c, a)));

  server.registerTool("savetrix_invoice_post_to_qb", {
    title: "Post invoice to QuickBooks",
    description:
      "Send an approved invoice into QuickBooks and mark it posted. Destructive: requires confirm=true.",
    inputSchema: S.postToQbSchema,
  }, run((c, a) => {
    const gate = requireConfirm(a, "post invoice to QuickBooks");
    if (!gate.ok) throw new Error(gate.message);
    return invoicesClient.postInvoiceToQuickBooks(c, a);
  }));

  server.registerTool("savetrix_invoice_reject", {
    title: "Reject invoice",
    description:
      "Mark an invoice as rejected/failed (e.g. duplicate or bad scan), with an optional reason. Destructive: requires confirm=true.",
    inputSchema: S.rejectInvoiceSchema,
  }, run((c, a) => {
    const gate = requireConfirm(a, "reject invoice");
    if (!gate.ok) throw new Error(gate.message);
    return invoicesClient.rejectInvoice(c, a);
  }));

  // ── Vendors ───────────────────────────────────────────────────────────
  server.registerTool("savetrix_vendor_list", {
    title: "List vendors",
    description: "List active (default) or deactivated vendors for the active QuickBooks connection.",
    inputSchema: S.vendorListSchema,
  }, run((c, a) => vendorsClient.listVendors(c, a.status)));

  server.registerTool("savetrix_vendor_create", {
    title: "Create vendor",
    description: "Create a new vendor in QuickBooks (e.g. 'Acme Ltd').",
    inputSchema: S.vendorCreateSchema,
  }, run((c, a) => vendorsClient.createVendor(c, a)));

  server.registerTool("savetrix_vendor_update", {
    title: "Update vendor",
    description: "Update a vendor's email, phone, address, currency, default category, or tax code.",
    inputSchema: S.vendorUpdateSchema,
  }, run((c, a) => vendorsClient.updateVendor(c, a)));

  server.registerTool("savetrix_vendor_deactivate", {
    title: "Deactivate vendor",
    description:
      "Deactivate a vendor you no longer use. The vendor is hidden but not permanently destroyed. Destructive: requires confirm=true.",
    inputSchema: S.deactivateVendorSchema,
  }, run((c, a) => {
    const gate = requireConfirm(a, "deactivate vendor");
    if (!gate.ok) throw new Error(gate.message);
    return vendorsClient.deactivateVendor(c, a.vendorId);
  }));

  server.registerTool("savetrix_vendor_reactivate", {
    title: "Reactivate vendor",
    description: "Bring a previously deactivated vendor back.",
    inputSchema: S.vendorIdSchema,
  }, run((c, a) => vendorsClient.reactivateVendor(c, a.vendorId)));

  // ── GL accounts ───────────────────────────────────────────────────────
  server.registerTool("savetrix_account_list", {
    title: "List GL accounts",
    description: "List accounting categories (GL accounts) for the active QuickBooks connection.",
    inputSchema: S.confirmSchema.omit({ confirm: true }),
  }, run((c) => accountsClient.listAccounts(c)));

  server.registerTool("savetrix_account_create", {
    title: "Create GL account",
    description: "Create a new GL account in QuickBooks. You pick the account type (e.g. Expense).",
    inputSchema: S.accountCreateSchema,
  }, run((c, a) => accountsClient.createAccount(c, a)));

  server.registerTool("savetrix_account_sync", {
    title: "Sync GL accounts",
    description: "Pull the latest GL accounts from QuickBooks into the app.",
    inputSchema: S.confirmSchema.omit({ confirm: true }),
  }, run((c) => accountsClient.syncAccounts(c)));

  // ── Tax codes ─────────────────────────────────────────────────────────
  server.registerTool("savetrix_taxcode_list", {
    title: "List tax codes",
    description: "List tax codes for the active QuickBooks connection.",
    inputSchema: S.confirmSchema.omit({ confirm: true }),
  }, run((c) => taxcodesClient.listTaxCodes(c)));

  server.registerTool("savetrix_taxcode_sync", {
    title: "Sync tax codes",
    description: "Pull the latest tax codes from QuickBooks into the app.",
    inputSchema: S.confirmSchema.omit({ confirm: true }),
  }, run((c) => taxcodesClient.syncTaxCodes(c)));

  // ── QuickBooks connection ─────────────────────────────────────────────
  server.registerTool("savetrix_qb_status", {
    title: "QuickBooks status",
    description: "Show the connection status for the active QuickBooks company.",
    inputSchema: S.confirmSchema.omit({ confirm: true }),
  }, run(async (c) => {
    const id = await c.resolveQbId();
    if (!id) return { connected: false, message: "No active QuickBooks connection." };
    return quickbooksClient.getStatus(c, id);
  }));

  server.registerTool("savetrix_qb_connections", {
    title: "List QuickBooks connections",
    description: "List the QuickBooks companies connected to this account.",
    inputSchema: S.confirmSchema.omit({ confirm: true }),
  }, run((c) => quickbooksClient.listConnections(c)));

  server.registerTool("savetrix_qb_set_active", {
    title: "Set active QuickBooks connection",
    description: "Switch which connected QuickBooks company the server operates on.",
    inputSchema: S.setActiveSchema,
  }, run(async (c, a) => {
    c.setActiveQbId(a.qbConnectionId);
    return { success: true, activeQbId: a.qbConnectionId };
  }));

  server.registerTool("savetrix_qb_connect", {
    title: "Connect QuickBooks",
    description:
      "Returns a clickable Intuit authorization link. The user opens it in a browser to authorize, then re-run savetrix_qb_connections to see the new company.",
    inputSchema: S.connectSchema,
  }, async (a) => {
    try {
      const url = await quickbooksClient.getConnectUrl(client, a.redirectAfter);
      return md(
        [
          "## Connect QuickBooks",
          "",
          `👉 **[Click here to authorize QuickBooks](${url})**`,
          "",
          "1. Open the link above in your browser.",
          "2. Sign in to Intuit and approve access for your company.",
          "3. Come back and run **savetrix_qb_connections** to confirm it connected.",
        ].join("\n"),
      );
    } catch (error) {
      return text({
        success: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  server.registerTool("savetrix_qb_disconnect", {
    title: "Disconnect QuickBooks",
    description: "Remove a QuickBooks connection. Destructive: requires confirm=true.",
    inputSchema: S.disconnectSchema,
  }, run((c, a) => {
    const gate = requireConfirm(a, "disconnect QuickBooks");
    if (!gate.ok) throw new Error(gate.message);
    return quickbooksClient.disconnect(c, a.qbConnectionId);
  }));

  // ── Team ──────────────────────────────────────────────────────────────
  server.registerTool("savetrix_team_list", {
    title: "List team members",
    description: "List members of the active QuickBooks team.",
    inputSchema: S.confirmSchema.omit({ confirm: true }),
  }, run((c) => teamClient.listTeamMembers(c)));

  server.registerTool("savetrix_team_invite", {
    title: "Invite team member",
    description: "Invite someone to the team with a role: admin, accountant, or contributor.",
    inputSchema: S.inviteMemberSchema,
  }, run((c, a) => teamClient.inviteTeamMember(c, a)));

  server.registerTool("savetrix_team_remove", {
    title: "Remove team member",
    description: "Remove a member from the team by member id. Destructive: requires confirm=true.",
    inputSchema: S.removeMemberSchema,
  }, run((c, a) => {
    const gate = requireConfirm(a, "remove team member");
    if (!gate.ok) throw new Error(gate.message);
    return teamClient.removeTeamMember(c, a.memberId);
  }));

  // ── Subscription ──────────────────────────────────────────────────────
  server.registerTool("savetrix_subscription_plans", {
    title: "List subscription plans",
    description: "Show available subscription plans and prices.",
    inputSchema: S.confirmSchema.omit({ confirm: true }),
  }, run((c) => subscriptionClient.listPlans(c)));

  server.registerTool("savetrix_subscription_my", {
    title: "My subscription",
    description: "Show the current subscription plan and billing cycle.",
    inputSchema: S.confirmSchema.omit({ confirm: true }),
  }, run((c) => subscriptionClient.getMySubscription(c)));

  server.registerTool("savetrix_subscription_choose", {
    title: "Change subscription plan",
    description:
      "Change the subscription plan (standard/enterprise) and billing cycle (monthly/yearly). Destructive: requires confirm=true.",
    inputSchema: S.choosePlanSchema,
  }, run((c, a) => {
    const gate = requireConfirm(a, "change subscription plan");
    if (!gate.ok) throw new Error(gate.message);
    return subscriptionClient.choosePlan(c, a);
  }));

};

export const buildServer = (config: Config): McpServer => {
  const server = new McpServer({
    name: "savetrix-mcp-server",
    version: "1.0.0",
  });
  registerSavetrixTools(server, createClient(config));
  return server;
};
