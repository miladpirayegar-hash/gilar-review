import { describe, expect, it } from 'vitest'
import type { IntegrationConnection, NormalizedExpense, NormalizedInvoice } from '../shared/domain/models'
import { demoScope } from '../server/demo/fixtures'
import { calculateQuickBooksAnalysis } from '../server/integrations/quickbooks/analysis'
import { normalizeRecord } from '../server/integrations/quickbooks/normalize'
import { EncryptedTokenVault, OAuthStateManager, QuickBooksOAuthService } from '../server/integrations/quickbooks/oauth'
import { QuickBooksConnector } from '../server/integrations/quickbooks/connector'
import { QuickBooksApiClient } from '../server/integrations/quickbooks/client'
import { InMemoryQuickBooksStore } from '../server/integrations/quickbooks/store'

const syncAt = '2026-10-22T00:00:00.000Z'

describe('QuickBooks security and OAuth foundations', () => {
  it('validates OAuth state, binds it to the workspace, and consumes it once', () => {
    const manager = new OAuthStateManager('state-secret')
    const state = manager.create({ scope: demoScope, userId: 'user-1' })
    expect(manager.consume(state, demoScope).userId).toBe('user-1')
    expect(() => manager.consume(state, demoScope)).toThrow()
    const otherScope = { organizationId: 'other-org', workspaceId: 'other-workspace' }
    const otherState = manager.create({ scope: demoScope, userId: 'user-1' })
    expect(() => manager.consume(otherState, otherScope)).toThrow('does not match')
    const tampered = `${state.split('.')[0]}.invalid`
    expect(() => manager.consume(tampered, demoScope)).toThrow('Invalid QuickBooks OAuth state.')
    const expired = manager.create({ scope: demoScope, userId: 'user-1' }, -1)
    expect(() => manager.consume(expired, demoScope)).toThrow('Expired QuickBooks OAuth state.')
  })

  it('encrypts tokens without exposing plaintext and refreshes access credentials', async () => {
    const vault = new EncryptedTokenVault('token-secret')
    const reference = vault.seal({ accessToken: 'access-secret', refreshToken: 'refresh-secret', tokenType: 'Bearer', accessTokenExpiresAt: syncAt })
    expect(reference).not.toContain('access-secret')
    expect(vault.unseal(reference).refreshToken).toBe('refresh-secret')
    const fetchMock: typeof fetch = async (_input, init) => {
      expect(String(init?.body)).toContain('refresh_token=refresh-secret')
      return new Response(JSON.stringify({ access_token: 'access-rotated', refresh_token: 'refresh-rotated', token_type: 'Bearer', expires_in: 3600, x_refresh_token_expires_in: 86400 }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    const oauth = new QuickBooksOAuthService(fetchMock, vault, new OAuthStateManager('state-secret'), { clientId: 'client', clientSecret: 'secret', redirectUri: 'http://localhost/callback' })
    const connection: IntegrationConnection = { id: 'connection-1', ...demoScope, integrationId: 'integration-1', realmId: 'realm-1', status: 'connected', syncStatus: 'synced', encryptedCredentialRef: reference, scopes: ['com.intuit.quickbooks.accounting'], createdAt: syncAt, updatedAt: syncAt }
    const refreshed = await oauth.refresh(connection)
    expect(vault.unseal(refreshed.encryptedCredentialRef!).accessToken).toBe('access-rotated')
    expect(refreshed.accessTokenExpiresAt).toBeDefined()
  })

  it('reports refresh failures without returning provider response bodies', async () => {
    const vault = new EncryptedTokenVault('token-secret')
    const oauth = new QuickBooksOAuthService(async () => new Response(JSON.stringify({ error: 'invalid_grant', refresh_token: 'must-not-leak' }), { status: 400 }), vault, new OAuthStateManager('state-secret'), { clientId: 'client', clientSecret: 'secret', redirectUri: 'http://localhost/callback' })
    const connection: IntegrationConnection = { id: 'connection-1', ...demoScope, integrationId: 'integration-1', realmId: 'realm-1', status: 'healthy', syncStatus: 'synced', encryptedCredentialRef: vault.seal({ accessToken: 'access-secret', refreshToken: 'refresh-secret', tokenType: 'Bearer', accessTokenExpiresAt: syncAt }), scopes: ['com.intuit.quickbooks.accounting'], createdAt: syncAt, updatedAt: syncAt }
    await expect(oauth.refresh(connection)).rejects.toThrow('expired or was revoked')
  })
})

describe('QuickBooks normalization and deterministic financial analysis', () => {
  it('normalizes source records with realm and external-record provenance', () => {
    const customer = normalizeRecord(demoScope, 'realm-1', 'Customer', { Id: 'cust-1', DisplayName: 'Acme Co', PrimaryEmailAddr: { Address: 'owner@acme.test' }, MetaData: { LastUpdatedTime: '2026-10-21T12:00:00Z' } }, syncAt)
    expect(customer.provenance.provider).toBe('quickbooks')
    expect(customer.provenance.realmId).toBe('realm-1')
    expect(customer.provenance.externalRecordId).toBe('cust-1')
    const purchase = normalizeRecord(demoScope, 'realm-1', 'Purchase', { Id: 'purchase-1', EntityRef: { value: 'vendor-1' }, TotalAmt: '12.50', TxnDate: '2026-10-20' }, syncAt)
    expect((purchase as NormalizedExpense).vendorId).toBe('vendor-1')
    const invoice = normalizeRecord(demoScope, 'realm-1', 'Invoice', { Id: 'invoice-1', TotalAmt: 100, Balance: 25, TxnDate: '2026-10-01', DueDate: '2026-10-15' }, syncAt) as NormalizedInvoice
    expect(invoice.issuedAt).toBe('2026-10-01')
    expect(invoice.balance).toBe(25)
  })

  it('calculates aging, trends, concentration, evidence, coverage, and honest opportunities', () => {
    const invoices = [
      normalizeRecord(demoScope, 'realm-1', 'Invoice', { Id: 'invoice-current', CustomerRef: { value: 'cust-1' }, TotalAmt: 48210, Balance: 48210, TxnDate: '2026-09-01', DueDate: '2026-10-01' }, syncAt),
      normalizeRecord(demoScope, 'realm-1', 'Invoice', { Id: 'invoice-baseline', CustomerRef: { value: 'cust-2' }, TotalAmt: 31900, Balance: 31900, TxnDate: '2026-05-01', DueDate: '2026-05-01' }, syncAt),
    ]
    const expenses = [
      normalizeRecord(demoScope, 'realm-1', 'Purchase', { Id: 'purchase-current', VendorRef: { value: 'vendor-1' }, TotalAmt: 30000, TxnDate: '2026-10-01', AccountRef: { value: 'expense-account' } }, syncAt),
      normalizeRecord(demoScope, 'realm-1', 'Purchase', { Id: 'purchase-baseline', VendorRef: { value: 'vendor-2' }, TotalAmt: 10000, TxnDate: '2026-05-01', AccountRef: { value: 'expense-account' } }, syncAt),
    ]
    const analysis = calculateQuickBooksAnalysis(demoScope, { customers: [], vendors: [], invoices: invoices.filter((record) => record.provenance.sourceEntityType === 'Invoice') as NormalizedInvoice[], payments: [], expenses: expenses.filter((record) => record.provenance.sourceEntityType === 'Purchase') as NormalizedExpense[], reports: { ProfitAndLoss: { Rows: { Row: [{ ColData: [{ value: 'Total Income' }, { value: '80000' }] }, { ColData: [{ value: 'Total Expenses' }, { value: '25000' }] }, { ColData: [{ value: 'Net Income' }, { value: '55000' }] }] } } } }, syncAt)
    expect(analysis.signals.map((signal) => signal.name)).toEqual(expect.arrayContaining(['Receivables deterioration', 'Expense growth is accelerating', 'Margin compression', 'Customer concentration risk']))
    expect(analysis.evidence.every((item) => item.sourceSystem === 'quickbooks')).toBe(true)
    expect(analysis.opportunities.every((opportunity) => opportunity.sourceSystem === 'quickbooks')).toBe(true)
    expect(analysis.opportunities.some((opportunity) => opportunity.impactOrigin === 'estimate')).toBe(true)
    expect(analysis.coverage.find((item) => item.dimension === 'Operations')?.status).toBe('insufficient')
    expect(analysis.metrics.find((metric) => metric.key === 'reported_revenue')?.origin).toBe('quickbooks_reported')
    expect(analysis.metrics.find((metric) => metric.key === 'reported_expenses')?.origin).toBe('quickbooks_reported')
  })

  it('syncs read-only pages and upserts duplicate external records', async () => {
    const vault = new EncryptedTokenVault('token-secret')
    const fetchMock: typeof fetch = async (input, init) => {
      expect(init?.method ?? 'GET').toBe('GET')
      const url = decodeURIComponent(String(input))
      if (url.includes('/query?query=select * from Customer')) return new Response(JSON.stringify({ QueryResponse: { Customer: [{ Id: 'cust-1', DisplayName: 'Acme Co' }] } }), { status: 200 })
      if (url.includes('/query?query=select * from Invoice')) return new Response(JSON.stringify({ QueryResponse: { Invoice: [{ Id: 'invoice-1', CustomerRef: { value: 'cust-1' }, TotalAmt: 1200, Balance: 1200, DueDate: '2026-10-01' }] } }), { status: 200 })
      if (url.includes('/query?query=select * from ')) return new Response(JSON.stringify({ QueryResponse: {} }), { status: 200 })
      if (url.includes('/reports/')) return new Response(JSON.stringify({ Rows: { Row: [] } }), { status: 200 })
      if (url.includes('/companyinfo/')) return new Response(JSON.stringify({ CompanyName: 'Northstar Sandbox' }), { status: 200 })
      return new Response('{}', { status: 404 })
    }
    const oauth = new QuickBooksOAuthService(fetchMock, vault, new OAuthStateManager('state-secret'), { clientId: 'client', clientSecret: 'secret', redirectUri: 'http://localhost/callback' })
    const connector = new QuickBooksConnector(fetchMock, oauth)
    const connection: IntegrationConnection = { id: 'connection-1', ...demoScope, integrationId: 'integration-1', realmId: 'realm-1', status: 'healthy', syncStatus: 'synced', encryptedCredentialRef: vault.seal({ accessToken: 'access', refreshToken: 'refresh', tokenType: 'Bearer', accessTokenExpiresAt: '2099-01-01T00:00:00.000Z' }), scopes: ['com.intuit.quickbooks.accounting'], createdAt: syncAt, updatedAt: syncAt }
    const result = await connector.sync(connection)
    expect(result.importedRecords).toBe(2)
    expect(result.normalizedRecords?.every((record) => record.provenance.realmId === 'realm-1')).toBe(true)
    const store = new InMemoryQuickBooksStore()
    await store.upsertRecords(demoScope, result.normalizedRecords ?? [])
    await store.upsertRecords(demoScope, result.normalizedRecords ?? [])
    expect(await store.listRecords(demoScope)).toHaveLength(2)
    expect(await store.listRecords({ organizationId: 'other-org', workspaceId: 'other-workspace' })).toHaveLength(0)
  })

  it('retries throttled API reads without exposing token material', async () => {
    const vault = new EncryptedTokenVault('token-secret')
    let attempts = 0
    const fetchMock: typeof fetch = async (input, init) => {
      expect(init?.method ?? 'GET').toBe('GET')
      expect(String(input)).not.toContain('access-secret')
      attempts += 1
      if (attempts === 1) return new Response('{}', { status: 429, headers: { 'retry-after': '0' } })
      return new Response(JSON.stringify({ QueryResponse: { Customer: [{ Id: 'cust-1' }] } }), { status: 200 })
    }
    const oauth = new QuickBooksOAuthService(fetchMock, vault, new OAuthStateManager('state-secret'), { clientId: 'client', clientSecret: 'secret', redirectUri: 'http://localhost/callback' })
    const client = new QuickBooksApiClient(oauth, fetchMock)
    const connection: IntegrationConnection = { id: 'connection-1', ...demoScope, integrationId: 'integration-1', realmId: 'realm-1', status: 'healthy', syncStatus: 'synced', encryptedCredentialRef: vault.seal({ accessToken: 'access-secret', refreshToken: 'refresh-secret', tokenType: 'Bearer', accessTokenExpiresAt: '2099-01-01T00:00:00.000Z' }), scopes: ['com.intuit.quickbooks.accounting'], createdAt: syncAt, updatedAt: syncAt }
    const result = await client.query(connection, 'Customer')
    expect(result.QueryResponse?.Customer).toHaveLength(1)
    expect(attempts).toBe(2)
  })

  it('isolates a failed entity while continuing read-only sync for the rest', async () => {
    const vault = new EncryptedTokenVault('token-secret')
    const fetchMock: typeof fetch = async (input, init) => {
      expect(init?.method ?? 'GET').toBe('GET')
      const url = decodeURIComponent(String(input))
      if (url.includes('/query?query=select * from Vendor')) return new Response('{}', { status: 500, headers: { 'retry-after': '0' } })
      if (url.includes('/query?query=select * from ')) return new Response(JSON.stringify({ QueryResponse: {} }), { status: 200 })
      if (url.includes('/reports/')) return new Response(JSON.stringify({ Rows: { Row: [] } }), { status: 200 })
      if (url.includes('/companyinfo/')) return new Response(JSON.stringify({ CompanyName: 'Northstar Sandbox' }), { status: 200 })
      return new Response('{}', { status: 404 })
    }
    const oauth = new QuickBooksOAuthService(fetchMock, vault, new OAuthStateManager('state-secret'), { clientId: 'client', clientSecret: 'secret', redirectUri: 'http://localhost/callback' })
    const connector = new QuickBooksConnector(fetchMock, oauth)
    const connection: IntegrationConnection = { id: 'connection-1', ...demoScope, integrationId: 'integration-1', realmId: 'realm-1', status: 'healthy', syncStatus: 'synced', encryptedCredentialRef: vault.seal({ accessToken: 'access', refreshToken: 'refresh', tokenType: 'Bearer', accessTokenExpiresAt: '2099-01-01T00:00:00.000Z' }), scopes: ['com.intuit.quickbooks.accounting'], createdAt: syncAt, updatedAt: syncAt }
    const result = await connector.sync(connection)
    expect(result.warnings.some((warning) => warning.startsWith('Vendor:'))).toBe(true)
    expect(result.stages?.find((stage) => stage.name === 'Vendor')?.status).toBe('failed')
    expect(result.stages?.find((stage) => stage.name === 'Customer')?.status).toBe('completed')
  })
})
