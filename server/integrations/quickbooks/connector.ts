import type { IntegrationConnection, QuickBooksNormalizedRecord, TenantScope } from '../../../shared/domain/models'
import type { ConnectContext, IntegrationProvider, SyncResult, SyncStage, SyncStageListener } from '../connector'
import { QuickBooksApiClient } from './client'
import { normalizeRecord } from './normalize'
import { QuickBooksOAuthService } from './oauth'
import { quickBooksEntityTypes, type QuickBooksJson } from './types'

function listFromQuery(response: { QueryResponse?: Record<string, unknown> }, entity: string): QuickBooksJson[] {
  const rows = response.QueryResponse?.[entity]
  return Array.isArray(rows) ? rows.filter((row): row is QuickBooksJson => Boolean(row && typeof row === 'object' && !Array.isArray(row))) : []
}

function isAuthorizationFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return message.includes('authorization expired') || message.includes('authorization has expired')
}

export class QuickBooksConnector implements IntegrationProvider {
  readonly provider = 'quickbooks' as const
  readonly oauth: QuickBooksOAuthService
  readonly client: QuickBooksApiClient

  constructor(fetchImpl: typeof fetch = fetch, oauth?: QuickBooksOAuthService) {
    this.oauth = oauth ?? new QuickBooksOAuthService(fetchImpl)
    this.client = new QuickBooksApiClient(this.oauth, fetchImpl)
  }

  connect(scope: TenantScope, authorizationCode: string, context?: ConnectContext): Promise<IntegrationConnection> { return this.oauth.exchangeCode(scope, authorizationCode, context?.state ?? '', context) }

  refreshAuth(connection: IntegrationConnection): Promise<IntegrationConnection> { return this.oauth.refresh(connection) }

  async sync(connection: IntegrationConnection, cursor?: string, onStage?: SyncStageListener): Promise<SyncResult> {
    if (!connection.realmId) throw new Error('QuickBooks connection is missing its realm ID.')
    const synchronizedAt = new Date().toISOString()
    const stages: SyncStage[] = []
    const normalizedRecords: QuickBooksNormalizedRecord[] = []
    const warnings: string[] = []
    const recordsByType: Record<string, number> = {}
    const notify = async () => { if (onStage) await onStage(structuredClone(stages)) }
    const cursorValues: Record<string, number> = (() => { try { const value: unknown = cursor ? JSON.parse(cursor) : {}; return value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === 'number')) : {} } catch { return {} } })()
    const nextCursorValues: Record<string, number> = {}

    const financialReports: Record<string, Record<string, unknown>> = {}
    const companyStage: SyncStage = { name: 'CompanyInfo', status: 'running' }
    stages.push(companyStage)
    await notify()
    try {
      financialReports.CompanyInfo = await this.client.getCompanyInfo(connection)
      companyStage.status = 'completed'
    } catch (error) {
      if (isAuthorizationFailure(error)) throw error
      companyStage.status = 'failed'
      companyStage.message = error instanceof Error ? error.message : 'Company information sync failed.'
      warnings.push(`CompanyInfo: ${companyStage.message}`)
    }
    await notify()

    for (const entity of quickBooksEntityTypes) {
      const stage: SyncStage = { name: entity, status: 'running' }
      stages.push(stage)
      await notify()
      try {
        let position = cursorValues[entity] ?? 1
        let imported = 0
        let complete = false
        for (let page = 0; page < 100; page += 1) {
          const response = await this.client.query(connection, entity, position)
          const rows = listFromQuery(response, entity)
          const records: QuickBooksNormalizedRecord[] = []
          for (const row of rows) {
            try {
              records.push(normalizeRecord({ organizationId: connection.organizationId, workspaceId: connection.workspaceId }, connection.realmId!, entity, row, synchronizedAt))
            } catch (error) {
              warnings.push(`${entity}: skipped one record because it could not be normalized.`)
            }
          }
          normalizedRecords.push(...records)
          imported += records.length
          position += rows.length
          if (rows.length < 1000) { complete = true; break }
        }
        if (!complete) nextCursorValues[entity] = position
        recordsByType[entity] = imported
        stage.status = 'completed'
        stage.importedRecords = imported
      } catch (error) {
        if (isAuthorizationFailure(error)) throw error
        stage.status = 'failed'
        stage.message = error instanceof Error ? error.message : 'QuickBooks entity sync failed.'
        warnings.push(`${entity}: ${stage.message}`)
      }
      await notify()
    }

    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const endDate = synchronizedAt.slice(0, 10)
    for (const report of ['ProfitAndLoss', 'BalanceSheet', 'AgedReceivableDetail']) {
      const stage: SyncStage = { name: report, status: 'running' }
      stages.push(stage)
      await notify()
      try {
        financialReports[report] = await this.client.getReport(connection, report, startDate, endDate)
        stage.status = 'completed'
      } catch (error) {
        if (isAuthorizationFailure(error)) throw error
        stage.status = 'failed'
        stage.message = error instanceof Error ? error.message : 'QuickBooks report sync failed.'
        warnings.push(`${report}: ${stage.message}`)
      }
      await notify()
    }
    return { importedRecords: normalizedRecords.length, cursor: Object.keys(nextCursorValues).length > 0 ? JSON.stringify(nextCursorValues) : undefined, warnings, normalizedRecords, recordsByType, financialReports, stages, lastSyncedAt: synchronizedAt }
  }

  async disconnect(connection: IntegrationConnection): Promise<void> { await this.client.revoke(connection) }

  async healthCheck(connection: IntegrationConnection): Promise<{ healthy: boolean; message?: string }> {
    try { await this.client.getCompanyInfo(connection); return { healthy: true } } catch (error) { return { healthy: false, message: error instanceof Error ? error.message : 'QuickBooks health check failed.' } }
  }
}
