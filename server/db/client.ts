import 'dotenv/config'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { schema } from './schema'

export type Database = NodePgDatabase<typeof schema>

export function createDatabase(connectionString = process.env.DATABASE_URL): { db: Database; pool: Pool } {
  if (!connectionString) throw new Error('DATABASE_URL is required when DEMO_MODE is false.')
  const pool = new Pool({ connectionString, max: Number(process.env.DB_POOL_SIZE ?? 10), ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined })
  return { db: drizzle(pool, { schema }), pool }
}
