import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { createDatabase } from './client'
import { env } from '../config/env'

if (!env.DATABASE_URL) {
  console.log('DATABASE_URL is not configured; skipping migrations in demo mode.')
} else {
  const { db, pool } = createDatabase(env.DATABASE_URL)
  await migrate(db, { migrationsFolder: 'server/db/migrations' })
  console.log('Database migrations applied.')
  await pool.end()
}
