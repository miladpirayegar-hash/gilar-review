import { createDatabase } from './client'
import { schema } from './schema'
import { env } from '../config/env'
import { demoOrganization, demoScope, demoUser, demoWorkspace } from '../demo/fixtures'

if (!env.DATABASE_URL) {
  console.log('DATABASE_URL is not configured; demo fixtures remain the active seed.')
} else {
  const { db, pool } = createDatabase(env.DATABASE_URL)
  const organizationId = crypto.randomUUID()
  const workspaceId = crypto.randomUUID()
  const userId = crypto.randomUUID()
  const membershipId = crypto.randomUUID()

  await db.insert(schema.organizations).values({ id: organizationId, name: env.DEMO_MODE ? demoOrganization.name : 'Gilar Organization', slug: `${demoOrganization.slug}-${organizationId.slice(0, 8)}`, status: 'active' })
  await db.insert(schema.workspaces).values({ id: workspaceId, organizationId, name: env.DEMO_MODE ? demoWorkspace.name : 'Primary Workspace', slug: `${demoWorkspace.slug}-${workspaceId.slice(0, 8)}`, timezone: demoWorkspace.timezone, currency: demoWorkspace.currency, status: 'active' })
  await db.insert(schema.users).values({ id: userId, email: env.DEMO_MODE ? demoUser.email : 'owner@example.com', displayName: env.DEMO_MODE ? demoUser.displayName : 'Workspace Owner', status: 'active' })
  await db.insert(schema.memberships).values({ id: membershipId, userId, organizationId, workspaceId, role: 'Owner', status: 'active' })
  console.log(`Seeded organization ${organizationId} and workspace ${workspaceId}. The demo scope is ${demoScope.organizationId}/${demoScope.workspaceId}.`)
  await pool.end()
}
