import { and, desc, eq } from 'drizzle-orm'
import type { IntegrationConnection, NormalizedBusinessRecord, QuickBooksNormalizedRecord, TenantScope } from '../../../shared/domain/models'
import { schema } from '../../db/schema'
import type { Database } from '../../db/client'
import type { SyncStage } from '../connector'
import type { QuickBooksAnalysis } from './analysis'
import type { QuickBooksJson } from './types'

export interface QuickBooksConnectionStore {
  get(scope: TenantScope): Promise<IntegrationConnection | undefined>
  save(scope: TenantScope, connection: IntegrationConnection): Promise<IntegrationConnection>
  remove(scope: TenantScope): Promise<void>
}

export interface QuickBooksAnalysisStore {
  upsertRecords(scope: TenantScope, records: NormalizedBusinessRecord[]): Promise<void>
  listRecords(scope: TenantScope): Promise<QuickBooksNormalizedRecord[]>
  saveState(scope: TenantScope, state: QuickBooksSyncState): Promise<void>
  getState(scope: TenantScope): Promise<QuickBooksSyncState | undefined>
}

export interface QuickBooksSyncState {
  syncRunId?: string
  mode?: 'initial' | 'manual' | 'incremental'
  cursor?: string
  status: 'idle' | 'queued' | 'syncing' | 'synced' | 'failed'
  stages: SyncStage[]
  recordsSynchronized: number
  companyName?: string
  lastSyncAt?: string
  lastSuccessfulSyncAt?: string
  lastError?: string
  analysis?: QuickBooksAnalysis
}

function scopeKey(scope: TenantScope): string { return `${scope.organizationId}:${scope.workspaceId}` }

export class InMemoryQuickBooksStore implements QuickBooksConnectionStore, QuickBooksAnalysisStore {
  private readonly connections = new Map<string, IntegrationConnection>()
  private readonly records = new Map<string, QuickBooksNormalizedRecord>()
  private readonly states = new Map<string, QuickBooksSyncState>()

  async get(scope: TenantScope): Promise<IntegrationConnection | undefined> { const connection = this.connections.get(scopeKey(scope)); return connection ? structuredClone(connection) : undefined }
  async save(scope: TenantScope, connection: IntegrationConnection): Promise<IntegrationConnection> { if (connection.organizationId !== scope.organizationId || connection.workspaceId !== scope.workspaceId) throw new Error('QuickBooks connection is outside the active workspace.'); this.connections.set(scopeKey(scope), structuredClone(connection)); return structuredClone(connection) }
  async remove(scope: TenantScope): Promise<void> { this.connections.delete(scopeKey(scope)) }
  async upsertRecords(scope: TenantScope, records: NormalizedBusinessRecord[]): Promise<void> { records.filter((record): record is QuickBooksNormalizedRecord => record.provenance.provider === 'quickbooks').forEach((record) => this.records.set(`${scopeKey(scope)}:${record.provenance.sourceEntityType}:${record.provenance.externalRecordId}`, structuredClone(record))) }
  async listRecords(scope: TenantScope): Promise<QuickBooksNormalizedRecord[]> { return [...this.records.entries()].filter(([key]) => key.startsWith(`${scopeKey(scope)}:`)).map(([, record]) => structuredClone(record)) }
  async saveState(scope: TenantScope, state: QuickBooksSyncState): Promise<void> { this.states.set(scopeKey(scope), structuredClone(state)) }
  async getState(scope: TenantScope): Promise<QuickBooksSyncState | undefined> { const state = this.states.get(scopeKey(scope)); return state ? structuredClone(state) : undefined }
}

function toConnection(row: typeof schema.integrationConnections.$inferSelect): IntegrationConnection {
  return { id: row.id, organizationId: row.organizationId, workspaceId: row.workspaceId, integrationId: row.integrationId, providerAccountId: row.providerAccountId ?? undefined, realmId: row.realmId ?? undefined, connectedUserId: row.connectedUserId ?? undefined, status: row.status as IntegrationConnection['status'], syncStatus: row.syncStatus as IntegrationConnection['syncStatus'], encryptedCredentialRef: row.encryptedCredentialRef ?? undefined, scopes: row.scopes, accessTokenExpiresAt: row.accessTokenExpiresAt?.toISOString(), refreshTokenExpiresAt: row.refreshTokenExpiresAt?.toISOString(), lastSyncedAt: row.lastSyncedAt?.toISOString(), lastSuccessfulSyncAt: row.lastSuccessfulSyncAt?.toISOString(), lastError: row.lastError ?? undefined, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }
}

export class DrizzleQuickBooksConnectionStore implements QuickBooksConnectionStore {
  constructor(private readonly db: Database) {}

  async get(scope: TenantScope): Promise<IntegrationConnection | undefined> {
    const [row] = await this.db.select({ connection: schema.integrationConnections }).from(schema.integrationConnections).innerJoin(schema.integrations, eq(schema.integrations.id, schema.integrationConnections.integrationId)).where(and(eq(schema.integrationConnections.organizationId, scope.organizationId), eq(schema.integrationConnections.workspaceId, scope.workspaceId), eq(schema.integrations.provider, 'quickbooks')))
    return row ? toConnection(row.connection) : undefined
  }

  async save(scope: TenantScope, connection: IntegrationConnection): Promise<IntegrationConnection> {
    const now = new Date(connection.updatedAt)
    await this.db.insert(schema.integrations).values({ id: connection.integrationId, organizationId: scope.organizationId, workspaceId: scope.workspaceId, provider: 'quickbooks', displayName: 'QuickBooks Online', status: connection.status, permissionLevel: 'observe', lastSyncedAt: connection.lastSyncedAt ? new Date(connection.lastSyncedAt) : undefined, createdAt: new Date(connection.createdAt), updatedAt: now }).onConflictDoUpdate({ target: schema.integrations.id, set: { status: connection.status, lastSyncedAt: connection.lastSyncedAt ? new Date(connection.lastSyncedAt) : undefined, updatedAt: now } })
    const values = { id: connection.id, organizationId: scope.organizationId, workspaceId: scope.workspaceId, integrationId: connection.integrationId, providerAccountId: connection.providerAccountId, realmId: connection.realmId, connectedUserId: connection.connectedUserId, status: connection.status, syncStatus: connection.syncStatus, encryptedCredentialRef: connection.encryptedCredentialRef, scopes: connection.scopes, accessTokenExpiresAt: connection.accessTokenExpiresAt ? new Date(connection.accessTokenExpiresAt) : undefined, refreshTokenExpiresAt: connection.refreshTokenExpiresAt ? new Date(connection.refreshTokenExpiresAt) : undefined, lastSyncedAt: connection.lastSyncedAt ? new Date(connection.lastSyncedAt) : undefined, lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt ? new Date(connection.lastSuccessfulSyncAt) : undefined, lastError: connection.lastError, createdAt: new Date(connection.createdAt), updatedAt: now }
    const [row] = await this.db.insert(schema.integrationConnections).values(values).onConflictDoUpdate({ target: schema.integrationConnections.id, set: { providerAccountId: values.providerAccountId, realmId: values.realmId, connectedUserId: values.connectedUserId, status: values.status, syncStatus: values.syncStatus, encryptedCredentialRef: values.encryptedCredentialRef, scopes: values.scopes, accessTokenExpiresAt: values.accessTokenExpiresAt, refreshTokenExpiresAt: values.refreshTokenExpiresAt, lastSyncedAt: values.lastSyncedAt, lastSuccessfulSyncAt: values.lastSuccessfulSyncAt, lastError: values.lastError, updatedAt: now } }).returning()
    return toConnection(row)
  }

  async remove(scope: TenantScope): Promise<void> {
    const current = await this.get(scope)
    if (!current) return
    await this.db.delete(schema.integrationConnections).where(and(eq(schema.integrationConnections.id, current.id), eq(schema.integrationConnections.organizationId, scope.organizationId), eq(schema.integrationConnections.workspaceId, scope.workspaceId)))
    await this.db.delete(schema.integrations).where(and(eq(schema.integrations.id, current.integrationId), eq(schema.integrations.organizationId, scope.organizationId), eq(schema.integrations.workspaceId, scope.workspaceId)))
  }
}

function isNormalizedRecord(value: unknown): value is QuickBooksNormalizedRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  const provenance = record.provenance
  return typeof record.id === 'string' && typeof record.organizationId === 'string' && typeof record.workspaceId === 'string' && Boolean(provenance && typeof provenance === 'object' && typeof (provenance as Record<string, unknown>).externalRecordId === 'string')
}

export class DrizzleQuickBooksAnalysisStore implements QuickBooksAnalysisStore {
  constructor(private readonly db: Database) {}

  async upsertRecords(scope: TenantScope, records: NormalizedBusinessRecord[]): Promise<void> {
    for (const record of records.filter((item): item is QuickBooksNormalizedRecord => item.provenance.provider === 'quickbooks')) {
      const payload = record as unknown as QuickBooksJson
      await this.db.insert(schema.normalizedRecords).values({ organizationId: scope.organizationId, workspaceId: scope.workspaceId, entityType: record.provenance.sourceEntityType, provider: 'quickbooks', realmId: record.provenance.realmId, externalRecordId: record.provenance.externalRecordId, sourceEntityType: record.provenance.sourceEntityType, sourceUpdatedAt: record.provenance.sourceUpdatedAt ? new Date(record.provenance.sourceUpdatedAt) : undefined, synchronizedAt: new Date(record.provenance.synchronizedAt), payload }).onConflictDoUpdate({ target: [schema.normalizedRecords.workspaceId, schema.normalizedRecords.provider, schema.normalizedRecords.entityType, schema.normalizedRecords.externalRecordId], set: { realmId: record.provenance.realmId, sourceUpdatedAt: record.provenance.sourceUpdatedAt ? new Date(record.provenance.sourceUpdatedAt) : undefined, synchronizedAt: new Date(record.provenance.synchronizedAt), payload, updatedAt: new Date() } })
    }
  }

  async listRecords(scope: TenantScope): Promise<QuickBooksNormalizedRecord[]> {
    const rows = await this.db.select().from(schema.normalizedRecords).where(and(eq(schema.normalizedRecords.organizationId, scope.organizationId), eq(schema.normalizedRecords.workspaceId, scope.workspaceId), eq(schema.normalizedRecords.provider, 'quickbooks')))
    return rows.map((row) => row.payload).filter(isNormalizedRecord)
  }

  async saveState(scope: TenantScope, state: QuickBooksSyncState): Promise<void> {
    const [integration] = await this.db.select({ id: schema.integrations.id }).from(schema.integrations).where(and(eq(schema.integrations.organizationId, scope.organizationId), eq(schema.integrations.workspaceId, scope.workspaceId), eq(schema.integrations.provider, 'quickbooks')))
    if (!integration) return
    const id = state.syncRunId ?? crypto.randomUUID()
    const startedAt = state.lastSyncAt ? new Date(state.lastSyncAt) : new Date()
    const completedAt = state.lastSuccessfulSyncAt ? new Date(state.lastSuccessfulSyncAt) : undefined
    const values = { id, organizationId: scope.organizationId, workspaceId: scope.workspaceId, integrationId: integration.id, mode: state.mode ?? 'manual', status: state.status, startedAt, completedAt, cursor: state.cursor, recordsSynced: state.recordsSynchronized, companyName: state.companyName, stages: state.stages as unknown as Record<string, unknown>[], analysis: state.analysis, lastError: state.lastError, updatedAt: new Date() }
    await this.db.insert(schema.integrationSyncRuns).values(values).onConflictDoUpdate({ target: schema.integrationSyncRuns.id, set: { status: values.status, completedAt: values.completedAt, cursor: values.cursor, recordsSynced: values.recordsSynced, companyName: values.companyName, stages: values.stages, analysis: values.analysis, lastError: values.lastError, updatedAt: values.updatedAt } })
    await this.db.delete(schema.integrationSyncEntities).where(and(eq(schema.integrationSyncEntities.syncRunId, id), eq(schema.integrationSyncEntities.organizationId, scope.organizationId), eq(schema.integrationSyncEntities.workspaceId, scope.workspaceId)))
    if (state.stages.length > 0) await this.db.insert(schema.integrationSyncEntities).values(state.stages.map((stage) => ({ organizationId: scope.organizationId, workspaceId: scope.workspaceId, syncRunId: id, entityType: stage.name, status: stage.status, recordsSynced: stage.importedRecords ?? 0, lastError: stage.message })))
  }

  async getState(scope: TenantScope): Promise<QuickBooksSyncState | undefined> {
    const [row] = await this.db.select().from(schema.integrationSyncRuns).where(and(eq(schema.integrationSyncRuns.organizationId, scope.organizationId), eq(schema.integrationSyncRuns.workspaceId, scope.workspaceId))).orderBy(desc(schema.integrationSyncRuns.startedAt)).limit(1)
    if (!row) return undefined
    return { syncRunId: row.id, mode: row.mode as QuickBooksSyncState['mode'], status: row.status as QuickBooksSyncState['status'], stages: row.stages as unknown as SyncStage[], recordsSynchronized: row.recordsSynced, companyName: row.companyName ?? undefined, lastSyncAt: row.startedAt.toISOString(), lastSuccessfulSyncAt: row.completedAt?.toISOString(), cursor: row.cursor ?? undefined, analysis: row.analysis as QuickBooksAnalysis | undefined, lastError: row.lastError ?? undefined }
  }
}

export class QuickBooksRuntimeStore implements QuickBooksConnectionStore, QuickBooksAnalysisStore {
  constructor(private readonly connectionStore: QuickBooksConnectionStore, private readonly analysisStore: QuickBooksAnalysisStore = new InMemoryQuickBooksStore()) {}
  get(scope: TenantScope): Promise<IntegrationConnection | undefined> { return this.connectionStore.get(scope) }
  save(scope: TenantScope, connection: IntegrationConnection): Promise<IntegrationConnection> { return this.connectionStore.save(scope, connection) }
  remove(scope: TenantScope): Promise<void> { return this.connectionStore.remove(scope) }
  upsertRecords(scope: TenantScope, records: NormalizedBusinessRecord[]): Promise<void> { return this.analysisStore.upsertRecords(scope, records) }
  listRecords(scope: TenantScope): Promise<QuickBooksNormalizedRecord[]> { return this.analysisStore.listRecords(scope) }
  saveState(scope: TenantScope, state: QuickBooksSyncState): Promise<void> { return this.analysisStore.saveState(scope, state) }
  getState(scope: TenantScope): Promise<QuickBooksSyncState | undefined> { return this.analysisStore.getState(scope) }
}
