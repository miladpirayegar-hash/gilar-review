import type { IntegrationConnection } from '../../../shared/domain/models'
import { env } from '../../config/env'
import type { QuickBooksJson, QuickBooksQueryResponse, QuickBooksReportResponse } from './types'
import type { QuickBooksOAuthService } from './oauth'

function wait(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)) }

export class QuickBooksApiClient {
  private readonly apiRoot = `${env.INTUIT_ENVIRONMENT === 'production' ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com'}/v${env.INTUIT_API_VERSION}/company`

  constructor(private readonly oauth: QuickBooksOAuthService, private readonly fetchImpl: typeof fetch = fetch) {}

  private async request<T>(connection: IntegrationConnection, path: string, init: RequestInit = {}): Promise<T> {
    if (!connection.realmId) throw new Error('QuickBooks connection is missing its realm ID.')
    if (!connection.encryptedCredentialRef) throw new Error('QuickBooks connection is missing its authorization.')
    const tokens = this.oauth.tokenVault.unseal(connection.encryptedCredentialRef)
    let lastStatus = 0
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await this.fetchImpl(`${this.apiRoot}/${connection.realmId}/${path}`, { ...init, headers: { Accept: 'application/json', ...(init.headers ?? {}), Authorization: `${tokens.tokenType} ${tokens.accessToken}` } })
      if (response.ok) return await response.json() as T
      lastStatus = response.status
      if (response.status !== 429 && response.status < 500) break
      const retryAfter = Number(response.headers.get('retry-after') ?? 0)
      await wait(Math.min(5000, retryAfter > 0 ? retryAfter * 1000 : 250 * (attempt + 1)))
    }
    if (lastStatus === 401) throw new Error('QuickBooks authorization expired.')
    if (lastStatus === 429) throw new Error('QuickBooks API rate limit reached; try syncing again shortly.')
    throw new Error('QuickBooks data request failed.')
  }

  query(connection: IntegrationConnection, entity: string, startPosition = 1, maxResults = 1000): Promise<QuickBooksQueryResponse> {
    const query = `select * from ${entity} startposition ${startPosition} maxresults ${maxResults}`
    return this.request<QuickBooksQueryResponse>(connection, `query?query=${encodeURIComponent(query)}`)
  }

  getCompanyInfo(connection: IntegrationConnection): Promise<QuickBooksJson> { return this.request<QuickBooksJson>(connection, 'companyinfo/' + connection.realmId) }

  getReport(connection: IntegrationConnection, report: string, startDate: string, endDate: string): Promise<QuickBooksReportResponse> {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate, accounting_method: 'Accrual' })
    return this.request<QuickBooksReportResponse>(connection, `reports/${report}?${params.toString()}`)
  }

  async revoke(connection: IntegrationConnection): Promise<void> {
    if (!connection.encryptedCredentialRef) return
    const tokens = this.oauth.tokenVault.unseal(connection.encryptedCredentialRef)
    const response = await this.fetchImpl('https://developer.api.intuit.com/v2/oauth2/tokens/revoke', { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${env.INTUIT_CLIENT_ID ?? ''}:${env.INTUIT_CLIENT_SECRET ?? ''}`).toString('base64')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: tokens.refreshToken }) })
    if (!response.ok && response.status !== 400 && response.status !== 401) throw new Error('QuickBooks authorization could not be revoked.')
  }
}
