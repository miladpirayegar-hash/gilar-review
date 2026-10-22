import type { NormalizedInvoice, NormalizedLead, TenantScope } from '../../shared/domain/models'
import { demoScope } from '../demo/fixtures'

export interface ExternalInvoiceRecord {
  externalId: string
  customerId?: string
  amount: number
  balance?: number
  issuedAt?: string
  dueDate: string
  paidAt?: string
  status: 'open' | 'paid' | 'overdue'
}

export interface ExternalLeadRecord {
  externalId: string
  source?: string
  createdAt: string
  firstResponseAt?: string
  status: 'new' | 'qualified' | 'won' | 'lost'
}

export function normalizeInvoice(scope: TenantScope, source: string, record: ExternalInvoiceRecord): NormalizedInvoice {
  return { id: `${source}:invoice:${record.externalId}`, ...scope, createdAt: record.issuedAt ?? record.dueDate, updatedAt: record.paidAt ?? record.dueDate, customerId: record.customerId, amount: record.amount, balance: record.balance ?? (record.status === 'paid' ? 0 : record.amount), issuedAt: record.issuedAt ?? record.dueDate, dueDate: record.dueDate, paidAt: record.paidAt, status: record.status, metadata: { source, externalId: record.externalId }, provenance: { provider: source === 'quickbooks' ? 'quickbooks' : 'internal', externalRecordId: record.externalId, sourceEntityType: 'Invoice', synchronizedAt: new Date().toISOString() } }
}

export function normalizeLead(scope: TenantScope, source: string, record: ExternalLeadRecord): NormalizedLead {
  return { id: `${source}:lead:${record.externalId}`, ...scope, createdAt: record.createdAt, updatedAt: record.firstResponseAt ?? record.createdAt, source: record.source, status: record.status, metadata: { source, externalId: record.externalId }, provenance: { provider: source === 'quickbooks' ? 'quickbooks' : 'internal', externalRecordId: record.externalId, sourceEntityType: 'Lead', synchronizedAt: new Date().toISOString() } }
}

export function createDemoNormalizedRecords() {
  return {
    invoices: [normalizeInvoice(demoScope, 'quickbooks', { externalId: 'invoice_1042', customerId: 'customer_acme', amount: 42000, dueDate: '2026-10-01T00:00:00.000Z', status: 'overdue' })],
    leads: [normalizeLead(demoScope, 'hubspot', { externalId: 'lead_203', source: 'website', createdAt: '2026-10-10T00:00:00.000Z', firstResponseAt: '2026-10-14T00:00:00.000Z', status: 'qualified' })],
  }
}
