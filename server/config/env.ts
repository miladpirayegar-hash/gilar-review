import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  APP_ORIGIN: z.string().url().default('http://localhost:5173'),
  DEMO_MODE: z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),
  DATABASE_URL: z.string().url().optional(),
  DB_POOL_SIZE: z.coerce.number().int().positive().default(10),
  DB_SSL: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  SESSION_SECRET: z.string().min(32).optional(),
  TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),
  GILAR_MODE: z.enum(['demo', 'synthetic', 'pilot', 'sandbox', 'production']).default('demo'),
  INTUIT_CLIENT_ID: z.string().min(1).optional(),
  INTUIT_CLIENT_SECRET: z.string().min(1).optional(),
  INTUIT_REDIRECT_URI: z.string().url().optional(),
  INTUIT_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  INTUIT_API_VERSION: z.string().regex(/^\d+$/).default('75'),
})

export const env = envSchema.parse(process.env)

if (!env.DEMO_MODE && !env.SESSION_SECRET) throw new Error('SESSION_SECRET must be configured when DEMO_MODE=false.')
if (!env.DEMO_MODE && !env.DATABASE_URL) throw new Error('DATABASE_URL must be configured when DEMO_MODE=false.')
if (env.GILAR_MODE !== 'demo' && !env.TOKEN_ENCRYPTION_KEY && !env.SESSION_SECRET) throw new Error('TOKEN_ENCRYPTION_KEY or SESSION_SECRET must be configured outside demo mode.')
