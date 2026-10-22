# Gilar architecture

## Layers

```text
React pages/components
        |
frontend services (demo adapter today, API adapter next)
        |
HTTP API / application services
        |
domain models + deterministic BI + permission policy
        |
tenant repositories / connector contracts
        |
PostgreSQL via Drizzle      external business systems
```

The UI no longer imports the demo fixture module directly. The current `src/services/demoService.ts` is a compatibility adapter that preserves the finished product flows while the API and persistence layer mature.

## Tenant isolation

`TenantScope` is required by every tenant repository operation. Repository reads filter by both `organizationId` and `workspaceId`; direct ID reads throw a tenant access error when the record is not in scope. API handlers derive scope from the authenticated membership rather than accepting tenant IDs from request bodies.

## Business intelligence pipeline

1. Connectors produce provider-specific records.
2. Normalization maps them into shared customer, invoice, lead, communication, document, subscription, and inventory contracts.
3. Metric observations are stored with source record references.
4. Modular signal rules compare current and baseline observations.
5. Diagnosis links issues to evidence and ordered root causes.
6. Opportunity scoring and ROI formulas produce ranked, explainable recommendations.
7. Actions are proposed, approval-gated, audited, and measured through outcomes.

## Persistence and deployment

`server/db/schema.ts` contains the PostgreSQL/Drizzle schema for organizations, workspaces, users, memberships, integrations, normalized metric data, BI entities, agent execution, approvals, outcomes, ROI, notifications, and audit events. Migrations live under `server/db/migrations` and can be generated with `npm run db:generate`.

Connector implementations should implement `IntegrationProvider` and keep credentials in an external secret manager. The application stores references and sync metadata, never raw provider secrets.

## QuickBooks read-only integration

`server/integrations/quickbooks` owns Intuit OAuth, encrypted token envelopes, the sandbox/production API base URL, retry and pagination behavior, QuickBooks-to-Gilar normalization, and deterministic financial analysis. The connector has no write methods for QuickBooks records. OAuth state is signed, short-lived, bound to the authenticated workspace and consumed once.

Sync runs persist per-entity progress, cursors, failures, normalized records, and analysis snapshots. The normalized-record uniqueness key is workspace + provider + entity type + external record ID, so re-syncs upsert rather than duplicate data. Disconnect revokes local authorization when possible and removes connection credentials; derived snapshots remain stored for audit/history but are not served as live QuickBooks analysis after disconnect.

QuickBooks coverage is explicit. Financial Health can be highly covered from accounting data, while Operations, People, and Marketing remain insufficient until the relevant systems are connected. QuickBooks-only root causes are marked unknown when accounting evidence shows a symptom but cannot establish the operational cause.
