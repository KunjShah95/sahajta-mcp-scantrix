# Connecting the Invoice App to an AI Assistant (MCP)

*A plain-English guide to what becomes possible — every read and every write operation.*

Prepared for the client · Last updated 31 July 2026

---

## 1. What is MCP, in one paragraph

**MCP (Model Context Protocol)** is a standard "adapter" that lets an AI assistant (like Claude or ChatGPT) safely connect to your software and actually *use* it — not just talk about it. Think of it as giving the AI a set of buttons it is allowed to press inside the invoice app. Once connected, you type a plain instruction ("upload this bill and send it to QuickBooks") and the assistant presses the right buttons for you.

Two kinds of buttons exist:

- **Read operations** — the AI *looks something up* and tells you. Nothing changes.
- **Write operations** — the AI *makes a change* — creates, updates, or deletes something. This guide focuses mostly on these, since that is what was asked.

## 2. The short version — what the assistant can do for you

Every capability below already exists in the invoice app today. MCP simply lets the AI operate them on your behalf through normal conversation.

- Upload a bill/invoice photo or PDF and have it read automatically.
- Review, correct, and approve the extracted details.
- Send an approved invoice into QuickBooks.
- Reject a bad or duplicate invoice.
- Manage your vendor list — add, edit, deactivate, and restore vendors.
- Manage accounting categories (GL accounts) — look them up and create new ones.
- Manage your team — invite people, list members, remove members.
- Check and change your subscription plan.
- Connect or disconnect your QuickBooks company.

## 3. Write operations, explained in simple terms

These are the actions that **change data**. Grouped by area.

### A. Invoices & Bills

| What you say | What the assistant does |
| --- | --- |
| "Upload this invoice." | Sends the photo/PDF into the app, which reads it and pulls out vendor, amounts, tax, dates, and line items automatically. |
| "Fix the vendor / change this amount / set the category." | Updates the extracted details on an invoice before it is posted (e.g. correcting the GL account or a wrong total). |
| "Post this to QuickBooks." | Sends the approved invoice into QuickBooks and marks it as posted. |
| "Reject this one." | Marks the invoice as rejected/failed (e.g. a duplicate or bad scan), with an optional reason. |

### B. Vendors (suppliers)

| What you say | What the assistant does |
| --- | --- |
| "Add a new vendor called Acme Ltd." | Creates the vendor in QuickBooks, with optional email, phone, address, currency, default category, and tax code. |
| "Update this vendor's email / address / currency." | Edits any detail on an existing vendor. |
| "Deactivate this vendor." | Deactivates a vendor you no longer use (hidden, not permanently destroyed). |
| "Bring that vendor back." | Reactivates a previously deactivated vendor. |

### C. Accounting categories (GL accounts)

| What you say | What the assistant does |
|---|---|
| "Create a new expense account called Software Subscriptions." | Creates a new GL account in QuickBooks (you pick the account type). |

### D. Your team

| What you say | What the assistant does |
| --- | --- |
| "Invite <jane@company.com> as an accountant." | Sends a team invite with a chosen role (admin, accountant, or contributor). |
| "Remove this member." | Removes someone from the team. |
| "Accept this invite." | Accepts an invite you were sent. |

### E. QuickBooks connection

| What you say | What the assistant does |
| --- | --- |
| "Connect my QuickBooks." | Starts the secure QuickBooks connection so invoices can be posted. |
| "Disconnect QuickBooks." | Removes the QuickBooks connection. |

### F. Subscription & account

| What you say | What the assistant does |
| --- | --- |
| "Switch me to the Enterprise yearly plan." | Changes your subscription plan and billing cycle. |
| "Update my profile picture." | Uploads a new profile image. |
| "Sign me up / log me in / log me out." | Handles account creation, login (including Google/Apple), and logout. |

## 4. Read operations (for completeness)

These only *fetch and show* information — they never change anything, so they are completely safe:

- List all invoices, or open the full details of one invoice.
- List active vendors, or list deactivated vendors.
- List accounting categories (GL accounts) and tax codes.
- Show your QuickBooks connection status and which companies are connected.
- List your team members.
- Show available subscription plans and your current subscription.

## 5. A realistic example

You could say, in one message:

> "Here's a bill from Acme. If Acme isn't already a vendor, add them. Then read the bill, put it under 'Office Supplies', and post it to QuickBooks."

The assistant would: check your vendor list (read) → create the vendor if missing (write) → upload and read the bill (write) → set the category (write) → post it to QuickBooks (write) — and report back what it did at each step.

## 6. Safety — important for peace of mind

- **Nothing happens without your login.** The assistant acts only inside *your* account, using *your* secure sign-in. It cannot see or touch anyone else's data.
- **You stay in control.** Write actions can be set to ask for confirmation before they run, so the AI never posts to QuickBooks or deletes a vendor behind your back.
- **Deactivate, not destroy.** Vendors are deactivated (and can be restored), not permanently wiped.
- **Everything is logged.** Each action the assistant takes is recorded, so there is a clear trail.

## 7. What is needed to switch this on

1. A small "MCP server" that exposes the app's existing operations to the AI (a one-time development task — the underlying operations already exist).
2. Your normal app login, so the assistant acts as you.
3. A connected QuickBooks company (only needed for QuickBooks-related actions).
4. An AI assistant that supports MCP (e.g. Claude Desktop / Claude Code).

## 8. Summary table

| Area | Read (look up) | Write (change) |
| --- | --- | --- |
| Invoices | List all, view one | Upload, edit details, post to QuickBooks, reject |
| Vendors | List active, list inactive | Create, update, deactivate, reactivate |
| GL accounts | List | Create |
| Tax codes | List | — |
| Team | List members | Invite, remove, accept invite |
| QuickBooks link | Status, connections | Connect, disconnect |
| Subscription | Plans, my plan | Switch plan |
| Account | — | Register, login, logout, profile picture |

---

*Note: this document lists what is technically possible. Which actions you actually enable for the AI is your choice — you can allow read-only, or read plus selected write actions.*
