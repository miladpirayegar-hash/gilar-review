import type { NormalizedAccount, NormalizedCustomer, NormalizedExpense, NormalizedInvoice, NormalizedPayment, NormalizedProduct, NormalizedRevenueTransaction, NormalizedVendor, QuickBooksNormalizedRecord, SourceProvenance, TenantScope } from '../../../shared/domain/models'
import type { QuickBooksEntityType, QuickBooksJson } from './types'

function stringValue(value: unknown): string | undefined { return typeof value === 'string' && value.length > 0 ? value : undefined }
function numberValue(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && Number.isFinite(Number(value)) ? Number(value) : undefined }
function objectValue(value: unknown): QuickBooksJson | undefined { return value && typeof value === 'object' && !Array.isArray(value) ? value as QuickBooksJson : undefined }
function refValue(value: unknown): string | undefined { return objectValue(value) ? stringValue(objectValue(value)?.value) : undefined }
function dateValue(value: unknown, fallback: string): string { return stringValue(value) ?? fallback }
function idValue(record: QuickBooksJson): string | undefined { return stringValue(record.Id) }
function displayName(record: QuickBooksJson): string { return stringValue(record.DisplayName) ?? stringValue(record.CompanyName) ?? stringValue(record.Name) ?? 'Unnamed QuickBooks record' }
function emailValue(record: QuickBooksJson): string | undefined { return stringValue(objectValue(record.PrimaryEmailAddr)?.Address) }
function sourceUpdatedAt(record: QuickBooksJson): string | undefined { return stringValue(objectValue(record.MetaData)?.LastUpdatedTime) }

function base(scope: TenantScope, provider: 'quickbooks', realmId: string, type: string, record: QuickBooksJson, synchronizedAt: string) {
  const externalRecordId = idValue(record)
  if (!externalRecordId) throw new Error(`QuickBooks ${type} record is missing its external ID.`)
  const createdAt = dateValue(objectValue(record.MetaData)?.CreateTime, synchronizedAt)
  return { id: `quickbooks:${type.toLowerCase()}:${externalRecordId}`, ...scope, createdAt, updatedAt: sourceUpdatedAt(record) ?? synchronizedAt, provenance: { provider, realmId, externalRecordId, sourceEntityType: type, sourceUpdatedAt: sourceUpdatedAt(record), synchronizedAt } satisfies SourceProvenance }
}

export function normalizeCustomer(scope: TenantScope, realmId: string, record: QuickBooksJson, synchronizedAt: string): NormalizedCustomer {
  return { ...base(scope, 'quickbooks', realmId, 'Customer', record, synchronizedAt), name: displayName(record), email: emailValue(record), externalRefs: [idValue(record)!] }
}

export function normalizeVendor(scope: TenantScope, realmId: string, record: QuickBooksJson, synchronizedAt: string): NormalizedVendor {
  return { ...base(scope, 'quickbooks', realmId, 'Vendor', record, synchronizedAt), name: displayName(record), email: emailValue(record), externalRefs: [idValue(record)!] }
}

export function normalizeInvoice(scope: TenantScope, realmId: string, record: QuickBooksJson, synchronizedAt: string): NormalizedInvoice {
  const issuedAt = dateValue(record.TxnDate, synchronizedAt)
  const dueDate = dateValue(record.DueDate, dateValue(record.TxnDate, synchronizedAt))
  const balance = numberValue(record.Balance) ?? numberValue(record.TotalAmt) ?? 0
  const paid = balance <= 0
  return { ...base(scope, 'quickbooks', realmId, 'Invoice', record, synchronizedAt), customerId: refValue(record.CustomerRef), amount: numberValue(record.TotalAmt) ?? 0, balance: Math.max(0, balance), issuedAt, dueDate, status: paid ? 'paid' : new Date(dueDate).getTime() < new Date(synchronizedAt).getTime() ? 'overdue' : 'open' }
}

export function normalizePayment(scope: TenantScope, realmId: string, record: QuickBooksJson, synchronizedAt: string): NormalizedPayment {
  const linkedTransactions = Array.isArray(record.Line) ? record.Line.flatMap((line) => { const lineObject = objectValue(line); const linked = lineObject && Array.isArray(lineObject.LinkedTxn) ? lineObject.LinkedTxn : []; return linked.flatMap((item) => { const ref = objectValue(item); const value = ref && stringValue(ref.TxnId); return value ? [value] : [] }) }) : []
  return { ...base(scope, 'quickbooks', realmId, 'Payment', record, synchronizedAt), customerId: refValue(record.CustomerRef), invoiceIds: linkedTransactions, amount: numberValue(record.TotalAmt) ?? 0, paidAt: dateValue(record.TxnDate, synchronizedAt) }
}

export function normalizeExpense(scope: TenantScope, realmId: string, record: QuickBooksJson, type: 'Bill' | 'Purchase', synchronizedAt: string): NormalizedExpense {
  return { ...base(scope, 'quickbooks', realmId, type, record, synchronizedAt), vendorId: refValue(record.VendorRef) ?? refValue(record.EntityRef), amount: numberValue(record.TotalAmt) ?? 0, occurredAt: dateValue(record.TxnDate, synchronizedAt), category: refValue(record.AccountRef) }
}

export function normalizeRevenueTransaction(scope: TenantScope, realmId: string, record: QuickBooksJson, synchronizedAt: string): NormalizedRevenueTransaction {
  return { ...base(scope, 'quickbooks', realmId, 'Invoice', record, synchronizedAt), customerId: refValue(record.CustomerRef), amount: numberValue(record.TotalAmt) ?? 0, occurredAt: dateValue(record.TxnDate, synchronizedAt), category: 'invoice' }
}

export function normalizeAccount(scope: TenantScope, realmId: string, record: QuickBooksJson, synchronizedAt: string): NormalizedAccount {
  return { ...base(scope, 'quickbooks', realmId, 'Account', record, synchronizedAt), name: displayName(record), accountType: stringValue(record.AccountType) ?? 'Unknown', balance: numberValue(record.CurrentBalance) }
}

export function normalizeProduct(scope: TenantScope, realmId: string, record: QuickBooksJson, synchronizedAt: string): NormalizedProduct {
  return { ...base(scope, 'quickbooks', realmId, 'Item', record, synchronizedAt), name: displayName(record), sku: stringValue(record.Sku), active: record.Active !== false }
}

export function normalizeRecord(scope: TenantScope, realmId: string, type: QuickBooksEntityType, record: QuickBooksJson, synchronizedAt: string): QuickBooksNormalizedRecord {
  if (type === 'Customer') return normalizeCustomer(scope, realmId, record, synchronizedAt)
  if (type === 'Vendor') return normalizeVendor(scope, realmId, record, synchronizedAt)
  if (type === 'Invoice') return normalizeInvoice(scope, realmId, record, synchronizedAt)
  if (type === 'Payment') return normalizePayment(scope, realmId, record, synchronizedAt)
  if (type === 'Bill' || type === 'Purchase') return normalizeExpense(scope, realmId, record, type, synchronizedAt)
  if (type === 'Account') return normalizeAccount(scope, realmId, record, synchronizedAt)
  return normalizeProduct(scope, realmId, record, synchronizedAt)
}
