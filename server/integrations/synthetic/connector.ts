import type { IntegrationConnection, IntegrationProviderType, TenantScope, NormalizedBusinessRecord } from '../../../shared/domain/models'
import { normalizeSyntheticRecords, type SyntheticRawRecord } from '../../normalization/synthetic'
import { type ConnectContext, type IntegrationProvider, type SyncResult, type SyncStage, type SyncStageListener } from '../connector'

export class SyntheticConnector implements IntegrationProvider {
  readonly provider: IntegrationProviderType

  constructor(private readonly records: SyntheticRawRecord[], provider: IntegrationProviderType) {
    this.provider = provider
  }

  async connect(scope: TenantScope, _authorizationCode: string, context?: ConnectContext): Promise<IntegrationConnection> {
    const now = new Date().toISOString()
    return {
      id: `synthetic-connection-${this.provider}-${scope.workspaceId}`,
      ...scope,
      integrationId: `integration_${this.provider}`,
      providerAccountId: `synthetic-${this.provider}`,
      connectedUserId: context?.connectedUserId,
      status: 'connected',
      syncStatus: 'synced',
      scopes: [`${this.provider}:read`],
      lastSyncedAt: now,
      lastSuccessfulSyncAt: now,
      createdAt: now,
      updatedAt: now,
    }
  }

  async refreshAuth(connection: IntegrationConnection): Promise<IntegrationConnection> { return { ...connection, status: 'connected', updatedAt: new Date().toISOString() } }

  async sync(connection: IntegrationConnection, _cursor?: string, onStage?: SyncStageListener): Promise<SyncResult> {
    const selected = this.records.filter((record) => record.provider === this.provider)
    const stageNames = ['Loading provider fixture', 'Normalizing records', 'Updating evidence graph']
    const stages: SyncStage[] = stageNames.map((name) => ({ name, status: 'pending' }))
    await onStage?.(stages)
    stages[0] = { ...stages[0], status: 'completed', importedRecords: selected.length, message: 'Synthetic source responded.' }
    await onStage?.(stages)
    const normalizedRecords: NormalizedBusinessRecord[] = normalizeSyntheticRecords(connection, selected, new Date().toISOString())
    stages[1] = { ...stages[1], status: 'completed', importedRecords: normalizedRecords.length, message: 'Provider payloads normalized into Gilar entities.' }
    await onStage?.(stages)
    stages[2] = { ...stages[2], status: 'completed', importedRecords: normalizedRecords.length, message: 'Cross-source relationships retained.' }
    await onStage?.(stages)
    const recordsByType = normalizedRecords.reduce<Record<string, number>>((counts, record) => {
      counts[record.provenance.sourceEntityType] = (counts[record.provenance.sourceEntityType] ?? 0) + 1
      return counts
    }, {})
    return { importedRecords: normalizedRecords.length, warnings: [], normalizedRecords, recordsByType, stages, lastSyncedAt: new Date().toISOString(), cursor: `synthetic:${this.provider}:v1` }
  }

  async disconnect(_connection: IntegrationConnection): Promise<void> { return undefined }
  async healthCheck(_connection: IntegrationConnection): Promise<{ healthy: boolean; message?: string }> { return { healthy: true, message: 'Synthetic fixture is deterministic and read-only.' } }
}

