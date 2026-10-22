import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { IntegrationConnection, TenantScope } from '../../../shared/domain/models'
import { env } from '../../config/env'
import type { ConnectContext } from '../connector'

export interface QuickBooksTokenSet {
  accessToken: string
  refreshToken: string
  tokenType: string
  accessTokenExpiresAt: string
  refreshTokenExpiresAt?: string
}

export interface QuickBooksOAuthState {
  scope: TenantScope
  userId: string
}

export interface TokenVault {
  seal(tokens: QuickBooksTokenSet): string
  unseal(reference: string): QuickBooksTokenSet
}

export interface QuickBooksOAuthConfig {
  clientId?: string
  clientSecret?: string
  redirectUri?: string
}

export class EncryptedTokenVault implements TokenVault {
  private readonly key: Buffer

  constructor(secret = env.TOKEN_ENCRYPTION_KEY ?? env.SESSION_SECRET ?? randomBytes(32).toString('hex')) {
    this.key = createHash('sha256').update(secret).digest()
  }

  seal(tokens: QuickBooksTokenSet): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.')
  }

  unseal(reference: string): QuickBooksTokenSet {
    const [version, ivValue, tagValue, encryptedValue] = reference.split('.')
    if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) throw new Error('Stored QuickBooks credentials are invalid.')
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivValue, 'base64url'))
      decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
      const plaintext = Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8')
      const value: unknown = JSON.parse(plaintext)
      if (!value || typeof value !== 'object') throw new Error('Invalid credential payload.')
      const record = value as Record<string, unknown>
      if (typeof record.accessToken !== 'string' || typeof record.refreshToken !== 'string' || typeof record.tokenType !== 'string' || typeof record.accessTokenExpiresAt !== 'string') throw new Error('Invalid credential payload.')
      return { accessToken: record.accessToken, refreshToken: record.refreshToken, tokenType: record.tokenType, accessTokenExpiresAt: record.accessTokenExpiresAt, refreshTokenExpiresAt: typeof record.refreshTokenExpiresAt === 'string' ? record.refreshTokenExpiresAt : undefined }
    } catch {
      throw new Error('Stored QuickBooks credentials could not be decrypted.')
    }
  }
}

interface OAuthTokenResponse {
  access_token: string
  refresh_token: string
  token_type?: string
  expires_in: number
  x_refresh_token_expires_in?: number
}

function asTokenResponse(value: unknown): OAuthTokenResponse {
  if (!value || typeof value !== 'object') throw new Error('Intuit returned an invalid token response.')
  const record = value as Record<string, unknown>
  if (typeof record.access_token !== 'string' || typeof record.refresh_token !== 'string' || typeof record.expires_in !== 'number') throw new Error('Intuit returned an incomplete token response.')
  return { access_token: record.access_token, refresh_token: record.refresh_token, token_type: typeof record.token_type === 'string' ? record.token_type : undefined, expires_in: record.expires_in, x_refresh_token_expires_in: typeof record.x_refresh_token_expires_in === 'number' ? record.x_refresh_token_expires_in : undefined }
}

function addSeconds(seconds: number): string { return new Date(Date.now() + seconds * 1000).toISOString() }

export class OAuthStateManager {
  private readonly states = new Map<string, { value: QuickBooksOAuthState; expiresAt: number }>()
  private readonly secret: string

  constructor(secret = env.SESSION_SECRET ?? randomBytes(32).toString('hex')) { this.secret = secret }

  create(value: QuickBooksOAuthState, ttlMs = 10 * 60 * 1000): string {
    const nonce = randomBytes(24).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ nonce, value, exp: Date.now() + ttlMs })).toString('base64url')
    const signature = createHmac('sha256', this.secret).update(payload).digest('base64url')
    this.states.set(nonce, { value, expiresAt: Date.now() + ttlMs })
    return `${payload}.${signature}`
  }

  consume(state: string, expectedScope: TenantScope): QuickBooksOAuthState {
    const [payload, signature] = state.split('.')
    if (!payload || !signature) throw new Error('Invalid QuickBooks OAuth state.')
    const expectedSignature = createHmac('sha256', this.secret).update(payload).digest()
    const receivedSignature = Buffer.from(signature, 'base64url')
    if (expectedSignature.length !== receivedSignature.length || !timingSafeEqual(expectedSignature, receivedSignature)) throw new Error('Invalid QuickBooks OAuth state.')
    let decoded: { nonce?: string; exp?: number }
    try { decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { nonce?: string; exp?: number } } catch { throw new Error('Invalid QuickBooks OAuth state.') }
    if (!decoded.nonce || !decoded.exp) throw new Error('Expired QuickBooks OAuth state.')
    if (decoded.exp < Date.now()) {
      this.states.delete(decoded.nonce)
      throw new Error('Expired QuickBooks OAuth state.')
    }
    const stored = this.states.get(decoded.nonce)
    this.states.delete(decoded.nonce)
    if (!stored || stored.expiresAt < Date.now() || stored.value.scope.organizationId !== expectedScope.organizationId || stored.value.scope.workspaceId !== expectedScope.workspaceId) throw new Error('QuickBooks OAuth state does not match the active workspace.')
    return stored.value
  }
}

export class QuickBooksOAuthService {
  readonly configured: boolean
  private readonly config: QuickBooksOAuthConfig
  private readonly tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
  readonly stateManager: OAuthStateManager
  readonly tokenVault: TokenVault

  constructor(private readonly fetchImpl: typeof fetch = fetch, tokenVault?: TokenVault, stateManager?: OAuthStateManager, config: QuickBooksOAuthConfig = { clientId: env.INTUIT_CLIENT_ID, clientSecret: env.INTUIT_CLIENT_SECRET, redirectUri: env.INTUIT_REDIRECT_URI }) {
    this.config = config
    this.configured = Boolean(config.clientId && config.clientSecret && config.redirectUri)
    this.tokenVault = tokenVault ?? new EncryptedTokenVault()
    this.stateManager = stateManager ?? new OAuthStateManager()
  }

  createAuthorizationUrl(scope: TenantScope, userId: string): string {
    if (!this.configured) throw new Error('QuickBooks is not configured. Add the Intuit client ID, client secret, and redirect URI.')
    const state = this.stateManager.create({ scope, userId })
    const params = new URLSearchParams({ client_id: this.config.clientId!, response_type: 'code', scope: 'com.intuit.quickbooks.accounting openid profile email', redirect_uri: this.config.redirectUri!, state })
    return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`
  }

  async exchangeCode(scope: TenantScope, code: string, state: string, context: ConnectContext = {}): Promise<IntegrationConnection> {
    const stateValue = this.stateManager.consume(state, scope)
    if (stateValue.userId !== context.connectedUserId && context.connectedUserId) throw new Error('QuickBooks OAuth user does not match the active session.')
    if (!this.configured) throw new Error('QuickBooks is not configured.')
    const response = await this.fetchImpl(this.tokenUrl, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${this.config.clientId!}:${this.config.clientSecret!}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: this.config.redirectUri! }) })
    if (!response.ok) throw new Error('QuickBooks authorization could not be completed.')
    const token = asTokenResponse(await response.json())
    const now = new Date().toISOString()
    return { id: crypto.randomUUID(), ...scope, integrationId: `integration_quickbooks_${crypto.randomUUID()}`, providerAccountId: context.realmId, realmId: context.realmId, connectedUserId: stateValue.userId, status: 'connected', syncStatus: 'queued', encryptedCredentialRef: this.tokenVault.seal({ accessToken: token.access_token, refreshToken: token.refresh_token, tokenType: token.token_type ?? 'Bearer', accessTokenExpiresAt: addSeconds(token.expires_in), refreshTokenExpiresAt: token.x_refresh_token_expires_in ? addSeconds(token.x_refresh_token_expires_in) : undefined }), scopes: ['com.intuit.quickbooks.accounting', 'openid', 'profile', 'email'], accessTokenExpiresAt: addSeconds(token.expires_in), refreshTokenExpiresAt: token.x_refresh_token_expires_in ? addSeconds(token.x_refresh_token_expires_in) : undefined, createdAt: now, updatedAt: now }
  }

  async refresh(connection: IntegrationConnection): Promise<IntegrationConnection> {
    if (!connection.encryptedCredentialRef) throw new Error('QuickBooks refresh credentials are missing.')
    if (!this.configured) throw new Error('QuickBooks is not configured.')
    const current = this.tokenVault.unseal(connection.encryptedCredentialRef)
    const response = await this.fetchImpl(this.tokenUrl, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${this.config.clientId!}:${this.config.clientSecret!}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: current.refreshToken }) })
    if (!response.ok) throw new Error('QuickBooks authorization has expired or was revoked.')
    const token = asTokenResponse(await response.json())
    const refreshedAt = new Date().toISOString()
    return { ...connection, status: 'healthy', encryptedCredentialRef: this.tokenVault.seal({ accessToken: token.access_token, refreshToken: token.refresh_token, tokenType: token.token_type ?? current.tokenType, accessTokenExpiresAt: addSeconds(token.expires_in), refreshTokenExpiresAt: token.x_refresh_token_expires_in ? addSeconds(token.x_refresh_token_expires_in) : current.refreshTokenExpiresAt }), accessTokenExpiresAt: addSeconds(token.expires_in), refreshTokenExpiresAt: token.x_refresh_token_expires_in ? addSeconds(token.x_refresh_token_expires_in) : current.refreshTokenExpiresAt, updatedAt: refreshedAt, lastError: undefined }
  }
}
