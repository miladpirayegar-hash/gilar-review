import type { TenantEntity, TenantScope } from '../../shared/domain/models'
import { assertTenantScope, TenantAccessError, type TenantRepository } from './interfaces'

export class InMemoryTenantRepository<T extends TenantEntity> implements TenantRepository<T> {
  private readonly records = new Map<string, T>()

  constructor(initial: T[] = []) {
    initial.forEach((record) => this.records.set(record.id, structuredClone(record)))
  }

  async list(scope: TenantScope): Promise<T[]> {
    return [...this.records.values()].filter((record) => record.organizationId === scope.organizationId && record.workspaceId === scope.workspaceId).map((record) => structuredClone(record))
  }

  async getById(scope: TenantScope, id: string): Promise<T | undefined> {
    const record = this.records.get(id)
    if (!record) return undefined
    assertTenantScope(record, scope)
    return structuredClone(record)
  }

  async create(scope: TenantScope, entity: T): Promise<T> {
    assertTenantScope(entity, scope)
    if (this.records.has(entity.id)) throw new Error(`Entity ${entity.id} already exists.`)
    this.records.set(entity.id, structuredClone(entity))
    return structuredClone(entity)
  }

  async replace(scope: TenantScope, entity: T): Promise<T> {
    assertTenantScope(entity, scope)
    if (!this.records.has(entity.id)) throw new TenantAccessError('The requested resource was not found in this workspace.')
    this.records.set(entity.id, structuredClone(entity))
    return structuredClone(entity)
  }
}

export async function getTenantEntityOrThrow<T extends TenantEntity>(repository: TenantRepository<T>, scope: TenantScope, id: string): Promise<T> {
  const entity = await repository.getById(scope, id)
  if (!entity) throw new TenantAccessError('The requested resource was not found in this workspace.')
  return entity
}
