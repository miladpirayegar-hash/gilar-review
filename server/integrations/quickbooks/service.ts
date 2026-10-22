import type { AuditEvent, IntegrationConnection, NormalizedCustomer, NormalizedExpense, NormalizedInvoice, NormalizedPayment, NormalizedVendor, QuickBooksNormalizedRecord, TenantScope } from '../../../shared/domain/models'
import type { SyncStage, SyncStageListener } from '../connector'
import { env } from '../../config/env'
import { QuickBooksConnector } from './connector'
import { calculateQuickBooksAnalysis, type QuickBooksAnalysis } from './analysis'
import { InMemoryQuickBooksStore, type QuickBooksAnalysisStore, type QuickBooksConnectionStore, type QuickBooksSyncState } from './store'
import type { QuickBooksReportResponse } from './types'
import { calculateHealthScore } from '../../services/bi'

export interface QuickBooksStatus {
  mode: typeof env.GILAR_MODE
  configured: boolean
  connected: boolean
  status: IntegrationConnection['status'] | 'not_connected'
  syncStatus: IntegrationConnection['syncStatus'] | 'idle'
  realmId?: string
  companyName?: string
  lastSyncAt?: string
  lastSuccessfulSyncAt?: string
  recordsSynchronized: number
  stages: SyncStage[]
  health?: { healthy: boolean; message?: string }
  lastError?: string
}

export interface QuickBooksAuditWriter { (scope: TenantScope, event: Omit<AuditEvent, 'id' | 'organizationId' | 'workspaceId' | 'createdAt' | 'updatedAt'>): Promise<void> }

function safeError(error: unknown): string { return error instanceof Error ? error.message : 'QuickBooks operation failed.' }
function recordType(record: QuickBooksNormalizedRecord): string { return record.provenance.sourceEntityType }
function isAuthorizationFailure(message: string): boolean { return message.toLowerCase().includes('authorization expired') || message.toLowerCase().includes('authorization has expired') || message.toLowerCase().includes('authorization could not') }

function companyNameFrom(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  if (typeof record.CompanyName === 'string') return record.CompanyName
  return companyNameFrom(record.CompanyInfo)
}

function liveStages(providerStages: SyncStage[]): SyncStage[] {
  const provider = providerStages.map((stage) => {
    const name = stage.name === 'CompanyInfo' ? 'Fetching company' : stage.name === 'Bill' || stage.name === 'Purchase' ? 'Syncing expenses' : `Syncing ${stage.name.toLowerCase()}s`
    return { ...stage, name }
  })
  const providerComplete = providerStages.length > 0 && providerStages.every((stage) => stage.status !== 'running')
  return [
    { name: 'Connecting securely', status: 'completed' },
    { name: 'Authenticated', status: 'completed' },
    ...provider,
    { name: 'Normalizing', status: providerComplete ? 'running' : 'pending' },
    { name: 'Calculating metrics', status: 'pending' },
    { name: 'Detecting signals', status: 'pending' },
    { name: 'Building Business MRI', status: 'pending' },
    { name: 'Complete', status: 'pending' },
  ]
}

function queuedStages(): SyncStage[] {
  return [
    { name: 'Connecting securely', status: 'running' },
    { name: 'Authenticated', status: 'pending' },
    { name: 'Fetching company', status: 'pending' },
    { name: 'Syncing customers', status: 'pending' },
    { name: 'Syncing vendors', status: 'pending' },
    { name: 'Syncing accounts', status: 'pending' },
    { name: 'Syncing invoices', status: 'pending' },
    { name: 'Syncing payments', status: 'pending' },
    { name: 'Syncing expenses', status: 'pending' },
    { name: 'Syncing items', status: 'pending' },
    { name: 'Normalizing', status: 'pending' },
    { name: 'Calculating metrics', status: 'pending' },
    { name: 'Detecting signals', status: 'pending' },
    { name: 'Building Business MRI', status: 'pending' },
    { name: 'Complete', status: 'pending' },
  ]
}

export class QuickBooksService {
  private readonly store: QuickBooksAnalysisStore & QuickBooksConnectionStore

  constructor(private readonly connector = new QuickBooksConnector(), store?: QuickBooksAnalysisStore & QuickBooksConnectionStore, private readonly audit?: QuickBooksAuditWriter) { this.store = store ?? new InMemoryQuickBooksStore() }

  getAuthorizationUrl(scope: TenantScope, userId: string): string { return this.connector.oauth.createAuthorizationUrl(scope, userId) }

  cancelAuthorization(scope: TenantScope, state: string): void {
    try { this.connector.oauth.stateManager.consume(state, scope) } catch { /* Invalid or expired denial states are safe to discard. */ }
  }

  async completeAuthorization(scope: TenantScope, code: string, state: string, realmId: string, userId: string): Promise<IntegrationConnection> {
    const connection = await this.connector.connect(scope, code, { realmId, connectedUserId: userId, state })
    const previous = await this.store.get(scope)
    const saved = await this.store.save(scope, previous && previous.realmId === realmId ? { ...connection, id: previous.id, integrationId: previous.integrationId, createdAt: previous.createdAt } : connection)
    await this.audit?.(scope, { actorUserId: userId, action: 'quickbooks.connected', resourceType: 'integration_connection', resourceId: saved.id, occurredAt: saved.createdAt, details: { provider: 'quickbooks', realmId } })
    return saved
  }

  async status(scope: TenantScope): Promise<QuickBooksStatus> {
    const connection = await this.store.get(scope)
    const state = await this.store.getState(scope)
    if (!connection) return { mode: env.GILAR_MODE, configured: this.connector.oauth.configured, connected: false, status: 'not_connected', syncStatus: state?.status === 'syncing' ? 'syncing' : 'idle', recordsSynchronized: state?.recordsSynchronized ?? 0, stages: state?.stages ?? [] }
    let current = connection
    if (current.accessTokenExpiresAt && new Date(current.accessTokenExpiresAt).getTime() < Date.now() + 60_000 && current.status !== 'expired') {
      try { current = await this.store.save(scope, await this.connector.refreshAuth(current)) } catch (error) {
        current = await this.store.save(scope, { ...current, status: 'expired', syncStatus: 'failed', lastError: safeError(error), updatedAt: new Date().toISOString() })
      }
    }
    let health = current.status === 'connected' || current.status === 'healthy' ? await this.connector.healthCheck(current) : undefined
    if (health && !health.healthy && isAuthorizationFailure(health.message ?? '')) {
      try {
        current = await this.store.save(scope, await this.connector.refreshAuth(current))
        health = await this.connector.healthCheck(current)
      } catch (error) {
        current = await this.store.save(scope, { ...current, status: 'expired', syncStatus: 'failed', lastError: safeError(error), updatedAt: new Date().toISOString() })
        health = { healthy: false, message: 'QuickBooks authorization has expired or was revoked.' }
      }
    }
    return { mode: env.GILAR_MODE, configured: this.connector.oauth.configured, connected: true, status: current.status, syncStatus: current.syncStatus, realmId: current.realmId, companyName: state?.companyName, lastSyncAt: current.lastSyncedAt, lastSuccessfulSyncAt: current.lastSuccessfulSyncAt, recordsSynchronized: state?.recordsSynchronized ?? 0, stages: state?.stages ?? [], health, lastError: current.lastError }
  }

  async sync(scope: TenantScope, mode: 'initial' | 'manual' | 'incremental' = 'manual'): Promise<QuickBooksAnalysis> {
    const existing = await this.store.get(scope)
    if (!existing) throw new Error('Connect QuickBooks before starting a sync.')
    const startAt = new Date().toISOString()
    const previousState = await this.store.getState(scope)
    const queuedState: QuickBooksSyncState = { mode, status: 'syncing', stages: queuedStages(), recordsSynchronized: previousState?.recordsSynchronized ?? 0, lastSyncAt: startAt, lastSuccessfulSyncAt: previousState?.lastSuccessfulSyncAt, cursor: mode === 'incremental' ? previousState?.cursor : undefined, analysis: previousState?.analysis }
    await this.store.saveState(scope, queuedState)
    const persistedQueuedState = await this.store.getState(scope)
    const syncRunId = persistedQueuedState?.syncRunId
    await this.audit?.(scope, { actorUserId: existing.connectedUserId, action: 'quickbooks.sync.started', resourceType: 'integration_connection', resourceId: existing.id, occurredAt: startAt, details: { mode } })
    let connection = await this.store.save(scope, { ...existing, status: 'syncing', syncStatus: 'syncing', updatedAt: startAt, lastError: undefined })
    let currentStages = queuedState.stages
    const publish: SyncStageListener = async (providerStages) => {
      currentStages = liveStages(providerStages)
      await this.store.saveState(scope, { ...queuedState, syncRunId, stages: currentStages })
    }
    try {
      if (connection.accessTokenExpiresAt && new Date(connection.accessTokenExpiresAt).getTime() < Date.now() + 60_000) connection = await this.connector.refreshAuth(connection)
      let result
      try {
        result = await this.connector.sync(connection, mode === 'incremental' ? previousState?.cursor : undefined, publish)
      } catch (error) {
        if (!isAuthorizationFailure(safeError(error))) throw error
        connection = await this.connector.refreshAuth(connection)
        result = await this.connector.sync(connection, mode === 'incremental' ? previousState?.cursor : undefined, publish)
      }
      const records = result.normalizedRecords ?? []
      await this.store.upsertRecords(scope, records)
      const allRecords = await this.store.listRecords(scope)
      const recordsForRealm = connection.realmId ? allRecords.filter((record) => record.provenance.realmId === connection.realmId) : allRecords
      const customers = recordsForRealm.filter((record): record is NormalizedCustomer => recordType(record) === 'Customer')
      const vendors = recordsForRealm.filter((record): record is NormalizedVendor => recordType(record) === 'Vendor')
      const invoices = recordsForRealm.filter((record): record is NormalizedInvoice => recordType(record) === 'Invoice')
      const payments = recordsForRealm.filter((record): record is NormalizedPayment => recordType(record) === 'Payment')
      const expenses = recordsForRealm.filter((record): record is NormalizedExpense => recordType(record) === 'Bill' || recordType(record) === 'Purchase')
      const analysis = calculateQuickBooksAnalysis(scope, { customers, vendors, invoices, payments, expenses, reports: result.financialReports as Record<string, QuickBooksReportResponse>, synchronizedAt: result.lastSyncedAt })
      const completedAt = result.lastSyncedAt ?? new Date().toISOString()
      const companyName = companyNameFrom(result.financialReports?.CompanyInfo)
      const pipelineStages: SyncStage[] = [
        { name: 'Connecting securely', status: 'completed' },
        { name: 'Authenticated', status: 'completed' },
        { name: 'Company identified', status: companyName ? 'completed' : 'failed', message: companyName ? undefined : 'Company information was not returned.' },
        { name: 'Financial data syncing', status: result.warnings.length ? 'failed' : 'completed', importedRecords: records.length, message: result.warnings.length ? result.warnings.join(' | ') : undefined },
        { name: 'Transactions normalized', status: records.length > 0 ? 'completed' : 'failed', importedRecords: records.length },
        { name: 'Metrics calculated', status: 'completed' },
        { name: 'Signals analyzed', status: 'completed', importedRecords: analysis.signals.length },
        { name: 'Business MRI generated', status: 'completed' },
        { name: 'Opportunities identified', status: 'completed', importedRecords: analysis.opportunities.length },
        { name: 'Complete', status: 'completed' },
      ]
      await this.store.saveState(scope, { syncRunId, mode, status: 'synced', stages: [...(result.stages ?? []), ...pipelineStages], recordsSynchronized: recordsForRealm.length, companyName, lastSyncAt: completedAt, lastSuccessfulSyncAt: completedAt, cursor: result.cursor, analysis })
      await this.store.save(scope, { ...connection, status: result.warnings.length ? 'needs_attention' : 'healthy', syncStatus: 'synced', lastSyncedAt: completedAt, lastSuccessfulSyncAt: completedAt, updatedAt: completedAt, lastError: result.warnings.length ? result.warnings.join(' | ') : undefined })
      await this.audit?.(scope, { actorUserId: existing.connectedUserId, action: result.warnings.length ? 'quickbooks.sync.completed_with_warnings' : 'quickbooks.sync.completed', resourceType: 'integration_connection', resourceId: existing.id, occurredAt: completedAt, details: { mode, recordsSynchronized: records.length, warnings: result.warnings } })
      return analysis
    } catch (error) {
      const message = safeError(error)
      const failedAt = new Date().toISOString()
      await this.store.saveState(scope, { syncRunId, mode, status: 'failed', stages: currentStages, recordsSynchronized: previousState?.recordsSynchronized ?? 0, lastSyncAt: failedAt, lastSuccessfulSyncAt: previousState?.lastSuccessfulSyncAt, cursor: previousState?.cursor, analysis: previousState?.analysis, lastError: message })
      await this.store.save(scope, { ...connection, status: message.includes('authorization') ? 'expired' : 'error', syncStatus: 'failed', updatedAt: failedAt, lastError: message })
      await this.audit?.(scope, { actorUserId: existing.connectedUserId, action: 'quickbooks.sync.failed', resourceType: 'integration_connection', resourceId: existing.id, occurredAt: failedAt, details: { mode, message } })
      throw error
    }
  }

  async getAnalysis(scope: TenantScope): Promise<QuickBooksAnalysis | undefined> {
    if (!(await this.store.get(scope))) return undefined
    return (await this.store.getState(scope))?.analysis
  }

  async getHealthScore(scope: TenantScope) {
    const analysis = await this.getAnalysis(scope)
    if (!analysis) return undefined
    const highSignalIds = new Set(analysis.signals.filter((signal) => signal.severity === 'high' || signal.severity === 'critical').map((signal) => signal.id))
    const financialSignals = analysis.signals.filter((signal) => signal.metricId.includes('revenue') || signal.metricId.includes('expense') || signal.metricId.includes('margin') || signal.metricId.includes('receivable'))
    const riskSignals = analysis.signals.filter((signal) => signal.metricId.includes('concentration') || signal.metricId.includes('receivable'))
    const score = (signals: typeof analysis.signals, base: number) => Math.max(0, Math.min(100, base - signals.reduce((total, signal) => total + (highSignalIds.has(signal.id) ? 12 : 5), 0)))
    const health = calculateHealthScore([
      { key: 'financial', label: 'Financial Health', score: score(financialSignals, 88), weight: .75, contributingSignalIds: financialSignals.map((signal) => signal.id) },
      { key: 'risk', label: 'Risk & Compliance', score: score(riskSignals, 84), weight: .25, contributingSignalIds: riskSignals.map((signal) => signal.id) },
    ])
    return { ...health, coverage: analysis.coverage.map((item) => ({ dimension: item.dimension, percentage: item.percentage, status: item.status, confidence: item.confidence })) }
  }

  async disconnect(scope: TenantScope, userId?: string): Promise<void> {
    const connection = await this.store.get(scope)
    if (!connection) return
    try { await this.connector.disconnect(connection) } finally {
      await this.store.remove(scope)
      await this.audit?.(scope, { actorUserId: userId ?? connection.connectedUserId, action: 'quickbooks.disconnected', resourceType: 'integration_connection', resourceId: connection.id, occurredAt: new Date().toISOString(), details: { provider: 'quickbooks', realmId: connection.realmId } })
    }
  }
}
