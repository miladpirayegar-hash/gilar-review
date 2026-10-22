# Gilar

Gilar is an operating system for small businesses: it connects business tools, normalizes operational data, finds meaningful signals, explains root causes, and recommends safe actions. The existing product UI remains demo-first while the application is being moved toward a tenant-safe production architecture.

## Run locally

```bash
npm install
npm run dev
```

The client runs through Vite. The API runs separately with `npm run server` and defaults to `http://localhost:8787` in demo mode.

Useful checks:

```bash
npm run typecheck
npm test
npm run db:generate
npm run db:migrate
npm run db:seed
```

`DEMO_MODE=true` is the safe default and does not require PostgreSQL. Set `DATABASE_URL` and `SESSION_SECRET` in a local `.env` before using the database-backed workflow.

## QuickBooks Online sandbox

QuickBooks is read-only in this milestone. Create an Intuit Developer app, enable the Accounting scope, create or select a sandbox company, and add this exact redirect URI to the app:

`http://localhost:8787/api/integrations/quickbooks/callback`

Copy `.env.example` to `.env` and set:

```text
DEMO_MODE=true
GILAR_MODE=sandbox
VITE_GILAR_MODE=sandbox
SESSION_SECRET=<at least 32 characters>  # recommended for stable OAuth state
TOKEN_ENCRYPTION_KEY=<at least 32 characters>
INTUIT_CLIENT_ID=<sandbox client id>
INTUIT_CLIENT_SECRET=<sandbox client secret>
INTUIT_REDIRECT_URI=http://localhost:8787/api/integrations/quickbooks/callback
INTUIT_ENVIRONMENT=sandbox
```

Omit `DATABASE_URL` for the local demo-session sandbox verifier.

The values that must come from the Intuit Developer Portal are `INTUIT_CLIENT_ID` and `INTUIT_CLIENT_SECRET`. `INTUIT_REDIRECT_URI` must exactly match the app's configured redirect URI, including protocol, host, port, path, and trailing characters. Keep all three credentials server-side; do not put them in React code or commit `.env`.

Run `npm run server`, and use the existing Connect Business flow. The API exposes `GET /api/integrations/quickbooks/connect`, the OAuth callback, `POST /api/integrations/quickbooks/sync`, status, and disconnect routes. Local sandbox mode uses the documented demo session and in-memory connection store while connecting to the real Intuit sandbox; omit `DATABASE_URL` because fixture tenant IDs are intentionally not database UUIDs. Tokens are encrypted before they are stored in the integration connection record; they are never returned to the browser or logged. Production uses the same flow with `DEMO_MODE=false`, `GILAR_MODE=production`, `INTUIT_ENVIRONMENT=production`, production credentials, a real session/OIDC `AuthProvider`, a registered HTTPS redirect URI, and database-backed encrypted credential references.

The sync reads company information, customers, vendors, accounts, invoices, payments, bills, purchases, items, Profit & Loss, Balance Sheet, and aged receivables. It normalizes records with QuickBooks realm and external IDs, calculates deterministic financial metrics, emits evidence-backed signals and opportunities, and reports insufficient data for dimensions QuickBooks cannot establish.

After completing OAuth in the browser, run `npm run qbo:verify` in a second terminal. It performs two read-only syncs, reports only counts/statuses and metric origins, checks upsert stability, validates Business MRI coverage, and walks one signal through evidence, issue, root-cause classification, opportunity, and recommendation. It requires the six sandbox variables shown above and will stop with setup instructions if OAuth has not yet connected a workspace. Because the Intuit sandbox credentials are environment-specific, a real sandbox run cannot be completed until those values are supplied.

## API surface

The API exposes health, dashboard, business health, opportunities, diagnosis, recommendations, agents, integrations, insights, notifications, ROI, and action approval endpoints under `/api`. Demo authentication resolves the seeded owner session; production authentication is intentionally isolated behind `AuthProvider` so an OIDC/session provider can replace it without changing domain services.

## Synthetic Northstar workspace

Set `GILAR_MODE=synthetic` to use the deterministic Northstar Distribution Co. workspace. It connects twelve synthetic source adapters (QuickBooks, Outlook, Gmail, Microsoft and Google calendars, Drive, OneDrive, Slack, HubSpot, Salesforce, Shopify, and CSV/Excel) through the same normalization seam as provider data. No external credentials or network calls are used. The workspace contains stable shared entities, cross-source evidence, ranked opportunities, approval-gated simulated actions, a developer-only Data Explorer, and a controlled `Advance 30 days` outcome measurement.

The synthetic controls are clearly marked in the UI. `Reset demo company` restores the pre-intervention state. Values labeled estimated, projected, or inferred are not presented as measured ROI; only the completed simulation writes an `Outcome` and `ROIRecord`.

## Product constraints

- UI pages and routes remain stable while data access moves behind services.
- Every tenant-owned repository read and write requires an organization/workspace scope.
- Signal detection, opportunity scoring, health scoring, and ROI use deterministic functions with source references.
- AI output is a provider seam with provenance and evidence IDs; the local fallback is deterministic and does not call an external model.
