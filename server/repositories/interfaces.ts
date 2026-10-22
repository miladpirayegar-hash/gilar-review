import type { TenantEntity, TenantScope } from '../../shared/domain/models'

export class TenantAccessError extends Error {
  readonly code = 'TENANT_ACCESS_DENIED'
  constructor(message = 'The requested resource is outside the active tenant scope.') {
    super(message)
    this.name = 'TenantAccessError'
  }
}

export interface TenantRepository<T extends TenantEntity> {
  list(scope: TenantScope): Promise<T[]>
  getById(scope: TenantScope, id: string): Promise<T | undefined>
  create(scope: TenantScope, entity: T): Promise<T>
  replace(scope: TenantScope, entity: T): Promise<T>
}

export function assertTenantScope(entity: TenantEntity, scope: TenantScope): void {
  if (entity.organizationId !== scope.organizationId || entity.workspaceId !== scope.workspaceId) {
    throw new TenantAccessError()
  }
}
