import type { IntegrationConnection, IntegrationProviderType, NormalizedBusinessRecord, TenantScope } from '../../shared/domain/models'

export interface SyncStage { name: string; status: 'pending' | 'running' | 'completed' | 'failed'; importedRecords?: number; message?: string }
export type SyncStageListener = (stages: SyncStage[]) => void | Promise<void>
export interface SyncResult { importedRecords: number; cursor?: string; warnings: string[]; normalizedRecords?: NormalizedBusinessRecord[]; financialReports?: Record<string, unknown>; recordsByType?: Record<string, number>; stages?: SyncStage[]; lastSyncedAt?: string }
export interface ConnectContext { realmId?: string; connectedUserId?: string; state?: string }

export interface IntegrationProvider {
  readonly provider: IntegrationProviderType
  connect(scope: TenantScope, authorizationCode: string, context?: ConnectContext): Promise<IntegrationConnection>
  refreshAuth(connection: IntegrationConnection): Promise<IntegrationConnection>
  sync(connection: IntegrationConnection, cursor?: string, onStage?: SyncStageListener): Promise<SyncResult>
  disconnect(connection: IntegrationConnection): Promise<void>
  healthCheck(connection: IntegrationConnection): Promise<{ healthy: boolean; message?: string }>
}

export class UnsupportedIntegrationProvider implements IntegrationProvider {
  constructor(public readonly provider: IntegrationProviderType) {}
  async connect(): Promise<IntegrationConnection> { throw new Error(`Provider ${this.provider} is not configured yet.`) }
  async refreshAuth(connection: IntegrationConnection): Promise<IntegrationConnection> { return connection }
  async sync(): Promise<SyncResult> { throw new Error(`Provider ${this.provider} is not configured yet.`) }
  async disconnect(): Promise<void> { return undefined }
  async healthCheck(): Promise<{ healthy: boolean; message: string }> { return { healthy: false, message: `Provider ${this.provider} is not configured yet.` } }
}

export class ConnectorRegistry {
  private readonly providers = new Map<IntegrationProviderType, IntegrationProvider>()
  register(provider: IntegrationProvider): void { this.providers.set(provider.provider, provider) }
  get(provider: IntegrationProviderType): IntegrationProvider { return this.providers.get(provider) ?? new UnsupportedIntegrationProvider(provider) }
}
