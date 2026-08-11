import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient } from "../client/savetrixClient.js";
import { UpstreamPayloadError } from "../client/unwrap.js";
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
const text = (value) => ({
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
});
const md = (markdown) => ({
    content: [{ type: "text", text: markdown }],
});
// A FAILED tool call. MCP's tools/call result carries isError precisely so a
// client and the model can tell a failure from data; without it a body that
// merely says {"success": false} arrives through the same channel as a real
// result and reads to the model like an answer. Every path below that reports
// a failure goes through one of these two, never through text()/md().
const failText = (value) => ({ ...text(value), isError: true });
const failMd = (markdown) => ({ ...md(markdown), isError: true });
/** Builds the title + annotations half of a registerTool config. */
const meta = (title, hints) => ({
    title,
    // Also mirrored into annotations.title: that is where the MCP spec put the
    // display name first, and clients predating the top-level Tool.title still
    // read it from there.
    annotations: {
        title,
        readOnlyHint: hints.readOnly,
        destructiveHint: hints.destructive,
        idempotentHint: hints.idempotent,
        openWorldHint: hints.openWorld,
    },
});
/** Pure read of our own backend. */
const READ = { readOnly: true, destructive: false, idempotent: true, openWorld: false };
/** Pure read whose data comes from QuickBooks via our backend. */
const READ_QB = { ...READ, openWorld: true };
/** Creates a new record — calling it twice creates two of them. */
const CREATE = { readOnly: false, destructive: false, idempotent: false, openWorld: false };
const CREATE_QB = { ...CREATE, openWorld: true };
/** Additive or repeatable write: no pre-existing value is overwritten. */
const WRITE = { readOnly: false, destructive: false, idempotent: true, openWorld: false };
const WRITE_QB = { ...WRITE, openWorld: true };
/** Overwrites, removes, deactivates, rejects, posts, or changes billing. */
const DESTRUCTIVE = { readOnly: false, destructive: true, idempotent: true, openWorld: false };
const DESTRUCTIVE_QB = { ...DESTRUCTIVE, openWorld: true };
// When a tool fails because the user is not signed in, or is signed in but has
// no active QuickBooks connection, return an actionable link (the pattern the
// big MCP connectors use) instead of a raw error. Returns markdown or null.
const authGuidance = async (client, error) => {
    const msg = error instanceof Error ? error.message : String(error);
    const status = error?.response?.status;
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
    let qbId;
    try {
        qbId = await client.resolveQbId();
    }
    catch { /* treat as not connected */ }
    if (!qbId) {
        let url;
        try {
            url = await quickbooksClient.getConnectUrl(client);
        }
        catch { /* fall back to tool */ }
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
// Applies the caller's explicit qbConnectionId override (if any) before
// running a tool. This server builds a fresh SavetrixClient per request (see
// handleMcp in remoteServer.ts), so savetrix_qb_set_active's effect on one
// call's client is gone by the next — resolveQbId() would otherwise silently
// re-derive whichever connection the backend flags "active" (connection
// health, not "what the user picked"). Setting it here, from the model's own
// explicit qbConnectionId argument, is what actually makes each individual
// call target the right company. See schemas.ts's qbConnectionIdOverride.
const applyQbOverride = (client, args) => {
    const override = args?.qbConnectionId;
    if (override)
        client.setActiveQbId(override);
};
const withClient = (client) => (fn) => async (args) => {
    applyQbOverride(client, args);
    try {
        return text(await fn(client, args));
    }
    catch (error) {
        // An upstream payload failure already carries the backend's own words
        // and is NOT an auth problem, so it must not be rewritten into "sign in
        // required" guidance just because that text happens to mention a token
        // ("QuickBooks token revoked" matches authGuidance's regex).
        if (error instanceof UpstreamPayloadError)
            return failText(error.toResult());
        const guide = await authGuidance(client, error);
        if (guide)
            return failMd(guide);
        return failText({
            success: false,
            message: error instanceof Error ? error.message : String(error),
        });
    }
};
/** Guidance shown whenever a remote upload needs a real transport. */
const uploadHelp = async (host) => {
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
        `👉 **[Click here to upload your invoice](${link})**`,
        "",
        "Pick the photo or PDF on that page. When it says *Uploaded ✓*, come back and ask me to list your invoices — I'll pick it up from there.",
        "",
        "_Already have the file at a public link? Give me the URL instead and I'll fetch it directly._",
    ].join("\n");
};
export const registerSavetrixTools = (server, client, host = {}) => {
    const run = withClient(client);
    // createUploadLink is supplied only by remoteServer.ts, so its presence is
    // what tells this registration apart from a local/stdio install. On the
    // remote connector filePath can only reach the connector's own container,
    // so it is dropped from the advertised schema AND refused at runtime.
    const isRemote = Boolean(host.createUploadLink);
    const uploadSchema = (isRemote ? S.invoiceUploadRemoteSchema : S.invoiceUploadSchema);
    // ── Onboarding ────────────────────────────────────────────────────────
    server.registerTool("savetrix_get_started", {
        ...meta("Get started / sign in", READ_QB),
        description: "Show a step-by-step onboarding guide with clickable links to sign in to Savetrix (scantrix.ai) and connect QuickBooks. Call this first if you are not sure whether you are logged in or connected.",
        inputSchema: S.confirmSchema.omit({ confirm: true }),
    }, async () => {
        const loggedIn = Boolean(client.getAccessToken());
        const web = client.webUrl;
        let qbConnected = false;
        let qbUrl;
        if (loggedIn) {
            try {
                const id = await client.resolveQbId();
                qbConnected = Boolean(id);
            }
            catch { /* ignore */ }
            if (!qbConnected) {
                try {
                    qbUrl = await quickbooksClient.getConnectUrl(client);
                }
                catch { /* surface generic step below */ }
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
        return md([
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
        ].join("\n"));
    });
    // ── Auth / account ────────────────────────────────────────────────────
    server.registerTool("savetrix_login", {
        ...meta("Login to Savetrix", WRITE),
        description: "Log in to the Savetrix invoice app with email and password. Sign up or reset a password at scantrix.ai. Required before any data operation if SAVETRIX_EMAIL/SAVETRIX_PASSWORD are not configured.",
        inputSchema: S.loginSchema,
    }, async (a) => {
        try {
            const payload = await client.login(a.email, a.password);
            const user = payload?.data?.user;
            const name = user?.firstName ? ` ${user.firstName}` : "";
            const web = client.webUrl;
            let qbConnected = false;
            let qbUrl;
            try {
                qbConnected = Boolean(await client.resolveQbId());
            }
            catch { /* ignore */ }
            if (!qbConnected) {
                try {
                    qbUrl = await quickbooksClient.getConnectUrl(client);
                }
                catch { /* ignore */ }
            }
            const next = qbConnected
                ? "✅ QuickBooks is connected — try `savetrix_invoice_list` or `savetrix_vendor_list`."
                : [
                    "**Next: connect QuickBooks**",
                    qbUrl
                        ? `👉 **[Authorize QuickBooks](${qbUrl})** in your browser, then run **savetrix_qb_connections**.`
                        : "Run **savetrix_qb_connect** to get your authorization link.",
                ].join("\n");
            return md([
                `## Signed in${name} ✅`,
                `Account: **${user?.email ?? a.email}**   ·   Web app: [${web}](${web}/)`,
                "",
                next,
                "",
                "To switch accounts, run **savetrix_logout** then **savetrix_login** again.",
            ].join("\n"));
        }
        catch (error) {
            return failMd([
                "## Sign-in failed ❌",
                error instanceof Error ? error.message : String(error),
                "",
                `Check your email/password, or sign up / reset at [${client.webUrl}](${client.webUrl}/).`,
            ].join("\n"));
        }
    });
    server.registerTool("savetrix_logout", {
        ...meta("Logout", WRITE),
        description: "Sign out of the current Savetrix session and clear stored tokens. Safe to call any time; run savetrix_login to sign back in.",
        inputSchema: S.confirmSchema.omit({ confirm: true }),
    }, async () => {
        try {
            await client.logout();
            const web = client.webUrl;
            return md([
                "## Signed out ✅",
                "Your session and stored tokens were cleared.",
                "",
                `Sign back in with **savetrix_login**, or open [${web}](${web}/).`,
            ].join("\n"));
        }
        catch (error) {
            return failText({
                success: false,
                message: error instanceof Error ? error.message : String(error),
            });
        }
    });
    server.registerTool("savetrix_account_info", {
        ...meta("Account info", READ),
        description: "Show which user the server is currently acting as.",
        inputSchema: S.confirmSchema.omit({ confirm: true }),
    }, run((c) => {
        const session = c.session.load();
        const user = session.user?.data?.user;
        return Promise.resolve({
            loggedIn: Boolean(c.getAccessToken()),
            user: user ?? null,
        });
    }));
    server.registerTool("savetrix_account_update_profile", {
        ...meta("Update profile", DESTRUCTIVE),
        description: "Update the logged-in user's firstName, lastName, or phone.",
        inputSchema: S.updateProfileSchema,
    }, run((c, a) => authClient.updateProfile(c, a)));
    // ── Invoices ──────────────────────────────────────────────────────────
    server.registerTool("savetrix_invoice_list", {
        ...meta("List invoices", READ),
        description: "List invoices for the active QuickBooks connection, with pagination.",
        inputSchema: S.invoiceListSchema,
    }, run((c, a) => invoicesClient.listInvoices(c, a)));
    server.registerTool("savetrix_invoice_get", {
        ...meta("Get invoice", READ),
        description: "Fetch the full details of a single invoice by its id.",
        inputSchema: S.invoiceIdSchema,
    }, run((c, a) => invoicesClient.getInvoice(c, a.invoiceId)));
    server.registerTool("savetrix_invoice_upload", {
        ...meta("Upload invoice", { ...CREATE, openWorld: true }),
        description: "Upload an invoice photo or PDF and have it scanned. Pass exactly one source. " +
            "Prefer fileUrl (a public https link the server downloads itself). " +
            "filePath works only when this server runs on the same machine as the chat client — a remote connector cannot see your filesystem, " +
            "so never pass a path from a chat sandbox (e.g. /mnt/user-data/...). " +
            "fileBase64 is for tiny files only. " +
            "If you have none of those, call this with no arguments (or use savetrix_invoice_upload_link) to get a browser upload link for the user.",
        inputSchema: uploadSchema,
    }, async (a) => {
        applyQbOverride(client, a);
        const hasSource = Boolean(a.fileUrl || a.filePath || a.fileBase64);
        if (!hasSource)
            return md(await uploadHelp(host));
        try {
            return text(await invoicesClient.uploadInvoice(client, a, { allowFilePath: !isRemote }));
        }
        catch (error) {
            const guide = await authGuidance(client, error);
            if (guide)
                return failMd(guide);
            // A path that only exists on the chat client's machine is the single most
            // common failure here (ENOENT on /mnt/user-data/uploads/...). Hand back
            // the upload link rather than a bare filesystem error — but as a failure,
            // because no invoice was uploaded. (Calling the tool with NO source at
            // all is a documented way to ask for that link, so that path above stays
            // a success.)
            const msg = error instanceof Error ? error.message : String(error);
            if (/ENOENT|no such file|not a file/i.test(msg)) {
                return failMd(await uploadHelp(host));
            }
            return failText({ success: false, message: msg });
        }
    });
    server.registerTool("savetrix_invoice_upload_link", {
        ...meta("Get an invoice upload link", CREATE),
        description: "Get a short-lived link the user can open in their browser to upload an invoice photo or PDF. " +
            "Use this whenever the user has a file on their own device and this server is remote.",
        inputSchema: S.qbScopedSchema,
    }, async (a) => {
        applyQbOverride(client, a);
        return md(await uploadHelp(host));
    });
    server.registerTool("savetrix_invoice_update", {
        ...meta("Update invoice details", DESTRUCTIVE),
        description: "Patch extracted details on an invoice before posting (e.g. correct vendor, amount, GL account/category, tax code).",
        inputSchema: S.invoiceUpdateSchema,
    }, run((c, a) => invoicesClient.updateInvoiceExtractedData(c, a)));
    server.registerTool("savetrix_invoice_post_to_qb", {
        ...meta("Post invoice to QuickBooks", { ...DESTRUCTIVE_QB, idempotent: false }),
        description: "Send an approved invoice into QuickBooks and mark it posted. Destructive: requires confirm=true.",
        inputSchema: S.postToQbSchema,
    }, run((c, a) => {
        const gate = requireConfirm(a, "post invoice to QuickBooks");
        if (!gate.ok)
            throw new Error(gate.message);
        return invoicesClient.postInvoiceToQuickBooks(c, a);
    }));
    server.registerTool("savetrix_invoice_reject", {
        ...meta("Reject invoice", DESTRUCTIVE),
        description: "Mark an invoice as rejected/failed (e.g. duplicate or bad scan), with an optional reason. Destructive: requires confirm=true.",
        inputSchema: S.rejectInvoiceSchema,
    }, run((c, a) => {
        const gate = requireConfirm(a, "reject invoice");
        if (!gate.ok)
            throw new Error(gate.message);
        return invoicesClient.rejectInvoice(c, a);
    }));
    // ── Vendors ───────────────────────────────────────────────────────────
    server.registerTool("savetrix_vendor_list", {
        ...meta("List vendors", READ_QB),
        description: "List active (default) or deactivated vendors for the active QuickBooks connection.",
        inputSchema: S.vendorListSchema,
    }, run((c, a) => vendorsClient.listVendors(c, a.status)));
    server.registerTool("savetrix_vendor_create", {
        ...meta("Create vendor", CREATE_QB),
        description: "Create a new vendor in QuickBooks (e.g. 'Acme Ltd').",
        inputSchema: S.vendorCreateSchema,
    }, run((c, a) => vendorsClient.createVendor(c, a)));
    server.registerTool("savetrix_vendor_update", {
        ...meta("Update vendor", DESTRUCTIVE_QB),
        description: "Update a vendor's email, phone, address, currency, default category, or tax code.",
        inputSchema: S.vendorUpdateSchema,
    }, run((c, a) => vendorsClient.updateVendor(c, a)));
    server.registerTool("savetrix_vendor_deactivate", {
        ...meta("Deactivate vendor", DESTRUCTIVE_QB),
        description: "Deactivate a vendor you no longer use. The vendor is hidden but not permanently destroyed. Destructive: requires confirm=true.",
        inputSchema: S.deactivateVendorSchema,
    }, run((c, a) => {
        const gate = requireConfirm(a, "deactivate vendor");
        if (!gate.ok)
            throw new Error(gate.message);
        return vendorsClient.deactivateVendor(c, a.vendorId);
    }));
    server.registerTool("savetrix_vendor_reactivate", {
        ...meta("Reactivate vendor", WRITE_QB),
        description: "Bring a previously deactivated vendor back.",
        inputSchema: S.vendorIdSchema,
    }, run((c, a) => vendorsClient.reactivateVendor(c, a.vendorId)));
    // ── GL accounts ───────────────────────────────────────────────────────
    server.registerTool("savetrix_account_list", {
        ...meta("List GL accounts", READ_QB),
        description: "List accounting categories (GL accounts) for the active QuickBooks connection.",
        inputSchema: S.qbScopedSchema,
    }, run((c) => accountsClient.listAccounts(c)));
    server.registerTool("savetrix_account_create", {
        ...meta("Create GL account", CREATE_QB),
        description: "Create a new GL account in QuickBooks. You pick the account type (e.g. Expense).",
        inputSchema: S.accountCreateSchema,
    }, run((c, a) => accountsClient.createAccount(c, a)));
    server.registerTool("savetrix_account_sync", {
        ...meta("Sync GL accounts", WRITE_QB),
        description: "Pull the latest GL accounts from QuickBooks into the app.",
        inputSchema: S.qbScopedSchema,
    }, run((c) => accountsClient.syncAccounts(c)));
    // ── Tax codes ─────────────────────────────────────────────────────────
    server.registerTool("savetrix_taxcode_list", {
        ...meta("List tax codes", READ_QB),
        description: "List tax codes for the active QuickBooks connection.",
        inputSchema: S.qbScopedSchema,
    }, run((c) => taxcodesClient.listTaxCodes(c)));
    server.registerTool("savetrix_taxcode_sync", {
        ...meta("Sync tax codes", WRITE_QB),
        description: "Pull the latest tax codes from QuickBooks into the app.",
        inputSchema: S.qbScopedSchema,
    }, run((c) => taxcodesClient.syncTaxCodes(c)));
    // ── QuickBooks connection ─────────────────────────────────────────────
    server.registerTool("savetrix_qb_status", {
        ...meta("QuickBooks status", READ_QB),
        description: "Show the connection status for the active QuickBooks company.",
        inputSchema: S.qbScopedSchema,
    }, run(async (c) => {
        const id = await c.resolveQbId();
        if (!id)
            return { connected: false, message: "No active QuickBooks connection." };
        return quickbooksClient.getStatus(c, id);
    }));
    server.registerTool("savetrix_qb_connections", {
        ...meta("List QuickBooks connections", READ_QB),
        description: "List the QuickBooks companies connected to this account.",
        inputSchema: S.confirmSchema.omit({ confirm: true }),
    }, run((c) => quickbooksClient.listConnections(c)));
    server.registerTool("savetrix_qb_set_active", {
        ...meta("Set active QuickBooks connection", READ),
        description: "Switch which connected QuickBooks company subsequent tool calls operate on. " +
            "IMPORTANT: this server is stateless between tool calls, so this only affects THIS " +
            "response, not future ones. You (the model) must pass the returned qbConnectionId " +
            "explicitly on every Savetrix tool call for the rest of the conversation — see the " +
            "warning in the result.",
        inputSchema: S.setActiveSchema,
    }, run(async (c, a) => {
        c.setActiveQbId(a.qbConnectionId);
        return {
            success: true,
            activeQbId: a.qbConnectionId,
            warning: `Pass qbConnectionId: "${a.qbConnectionId}" explicitly as an argument on every ` +
                "Savetrix tool call for the rest of this conversation. This server has no memory " +
                "between tool calls — without that argument, the next call silently falls back to " +
                "whichever connection the backend itself flags active, which may be a different company.",
        };
    }));
    server.registerTool("savetrix_qb_connect", {
        ...meta("Connect QuickBooks", { ...READ_QB, idempotent: false }),
        description: "Returns a clickable Intuit authorization link. The user opens it in a browser to authorize, then re-run savetrix_qb_connections to see the new company.",
        inputSchema: S.connectSchema,
    }, async (a) => {
        try {
            const url = await quickbooksClient.getConnectUrl(client, a.redirectAfter);
            return md([
                "## Connect QuickBooks",
                "",
                `👉 **[Click here to authorize QuickBooks](${url})**`,
                "",
                "1. Open the link above in your browser.",
                "2. Sign in to Intuit and approve access for your company.",
                "3. Come back and run **savetrix_qb_connections** to confirm it connected.",
            ].join("\n"));
        }
        catch (error) {
            return failText({
                success: false,
                message: error instanceof Error ? error.message : String(error),
            });
        }
    });
    server.registerTool("savetrix_qb_disconnect", {
        ...meta("Disconnect QuickBooks", DESTRUCTIVE_QB),
        description: "Remove a QuickBooks connection. Destructive: requires confirm=true.",
        inputSchema: S.disconnectSchema,
    }, run((c, a) => {
        const gate = requireConfirm(a, "disconnect QuickBooks");
        if (!gate.ok)
            throw new Error(gate.message);
        return quickbooksClient.disconnect(c, a.qbConnectionId);
    }));
    // ── Team ──────────────────────────────────────────────────────────────
    server.registerTool("savetrix_team_list", {
        ...meta("List team members", READ),
        description: "List members of the active QuickBooks team.",
        inputSchema: S.qbScopedSchema,
    }, run((c) => teamClient.listTeamMembers(c)));
    server.registerTool("savetrix_team_invite", {
        ...meta("Invite team member", { ...DESTRUCTIVE, idempotent: false, openWorld: true }),
        description: "Invite someone to the team with a role: admin, accountant, or contributor.",
        inputSchema: S.inviteMemberSchema,
    }, run((c, a) => teamClient.inviteTeamMember(c, a)));
    server.registerTool("savetrix_team_remove", {
        ...meta("Remove team member", DESTRUCTIVE),
        description: "Remove a member from the team by member id. Destructive: requires confirm=true.",
        inputSchema: S.removeMemberSchema,
    }, run((c, a) => {
        const gate = requireConfirm(a, "remove team member");
        if (!gate.ok)
            throw new Error(gate.message);
        return teamClient.removeTeamMember(c, a.memberId);
    }));
    // ── Subscription ──────────────────────────────────────────────────────
    server.registerTool("savetrix_subscription_plans", {
        ...meta("List subscription plans", READ),
        description: "Show available subscription plans and prices.",
        inputSchema: S.confirmSchema.omit({ confirm: true }),
    }, run((c) => subscriptionClient.listPlans(c)));
    server.registerTool("savetrix_subscription_my", {
        ...meta("My subscription", READ),
        description: "Show the current subscription plan and billing cycle.",
        inputSchema: S.confirmSchema.omit({ confirm: true }),
    }, run((c) => subscriptionClient.getMySubscription(c)));
    server.registerTool("savetrix_subscription_choose", {
        ...meta("Change subscription plan", { ...DESTRUCTIVE, openWorld: true }),
        description: "Change the subscription plan (standard/enterprise) and billing cycle (monthly/yearly). Destructive: requires confirm=true.",
        inputSchema: S.choosePlanSchema,
    }, run((c, a) => {
        const gate = requireConfirm(a, "change subscription plan");
        if (!gate.ok)
            throw new Error(gate.message);
        return subscriptionClient.choosePlan(c, a);
    }));
};
export const buildServer = (config) => {
    const server = new McpServer({
        name: "savetrix-mcp-server",
        version: "1.0.0",
    });
    registerSavetrixTools(server, createClient(config));
    return server;
};
