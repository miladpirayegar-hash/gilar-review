import { and, eq } from 'drizzle-orm'
import type { Workspace, TenantScope } from '../../shared/domain/models'
import { assertTenantScope, type TenantRepository } from './interfaces'
import { schema } from '../db/schema'
import type { Database } from '../db/client'

type WorkspaceRow = typeof schema.workspaces.$inferSelect

function toWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    organizationId: row.organizationId,
    workspaceId: row.id,
    name: row.name,
    slug: row.slug,
    timezone: row.timezone,
    currency: row.currency,
    status: row.status as Workspace['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** PostgreSQL-backed repository example. Other tenant repositories follow this same mapping pattern. */
export class DrizzleWorkspaceRepository implements TenantRepository<Workspace> {
  constructor(private readonly db: Database) {}

  async list(scope: TenantScope): Promise<Workspace[]> {
    const rows = await this.db.select().from(schema.workspaces).where(and(eq(schema.workspaces.organizationId, scope.organizationId), eq(schema.workspaces.id, scope.workspaceId)))
    return rows.map(toWorkspace)
  }

  async getById(scope: TenantScope, id: string): Promise<Workspace | undefined> {
    const [row] = await this.db.select().from(schema.workspaces).where(eq(schema.workspaces.id, id))
    if (!row) return undefined
    const workspace = toWorkspace(row)
    assertTenantScope(workspace, scope)
    return workspace
  }

  async create(scope: TenantScope, workspace: Workspace): Promise<Workspace> {
    assertTenantScope(workspace, scope)
    const [row] = await this.db.insert(schema.workspaces).values({ id: workspace.id, organizationId: workspace.organizationId, name: workspace.name, slug: workspace.slug, timezone: workspace.timezone, currency: workspace.currency, status: workspace.status, createdAt: new Date(workspace.createdAt), updatedAt: new Date(workspace.updatedAt) }).returning()
    return toWorkspace(row)
  }

  async replace(scope: TenantScope, workspace: Workspace): Promise<Workspace> {
    assertTenantScope(workspace, scope)
    const [row] = await this.db.update(schema.workspaces).set({ name: workspace.name, slug: workspace.slug, timezone: workspace.timezone, currency: workspace.currency, status: workspace.status, updatedAt: new Date(workspace.updatedAt) }).where(and(eq(schema.workspaces.id, workspace.id), eq(schema.workspaces.organizationId, scope.organizationId))).returning()
    return row ? toWorkspace(row) : workspace
  }
}
