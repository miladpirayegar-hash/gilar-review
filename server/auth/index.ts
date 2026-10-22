import type { NextFunction, Request, Response } from 'express'
import type { Membership, User } from '../../shared/domain/models'
import { demoMembership, demoUser } from '../demo/fixtures'
import { env } from '../config/env'

export interface AuthSession {
  user: User
  membership: Membership
}

export interface AuthProvider {
  resolveSession(request: Request): Promise<AuthSession | undefined>
}

export class DemoAuthProvider implements AuthProvider {
  async resolveSession(): Promise<AuthSession> { return { user: demoUser, membership: demoMembership } }
}

export type SessionResolver = (request: Request) => Promise<AuthSession | undefined>

export class ResolverAuthProvider implements AuthProvider {
  constructor(private readonly resolver: SessionResolver) {}

  resolveSession(request: Request): Promise<AuthSession | undefined> {
    return this.resolver(request)
  }
}

export function createAuthProvider(): AuthProvider {
  if (env.DEMO_MODE) return new DemoAuthProvider()
  throw new Error('Production authentication is not configured. Supply an AuthProvider backed by the application session or OIDC layer before setting DEMO_MODE=false.')
}

export function requireSession(provider: AuthProvider) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const session = await provider.resolveSession(request)
    if (!session) { response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'A valid session is required.' } }); return }
    response.locals.session = session
    next()
  }
}
