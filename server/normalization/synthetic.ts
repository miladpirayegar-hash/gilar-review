import type {
  IntegrationProviderType,
  NormalizedBusinessRecord,
  NormalizedCalendarEvent,
  NormalizedCommunicationEvent,
  NormalizedCustomer,
  NormalizedDeal,
  NormalizedDocument,
  NormalizedEmployee,
  NormalizedExpense,
  NormalizedInventoryRecord,
  NormalizedInvoice,
  NormalizedLead,
  NormalizedOrder,
  NormalizedPayment,
  NormalizedProduct,
  NormalizedPurchaseOrder,
  NormalizedSubscription,
  NormalizedTask,
  NormalizedVendor,
  TenantScope,
} from '../../shared/domain/models'

export type SyntheticEntityType =
  | 'customer'
  | 'vendor'
  | 'employee'
  | 'product'
  | 'invoice'
  | 'payment'
  | 'expense'
  | 'lead'
  | 'deal'
  | 'communication'
  | 'calendar_event'
  | 'document'
  | 'order'
  | 'inventory'
  | 'subscription'
  | 'task'
  | 'purchase_order'

export interface SyntheticRawRecord {
  provider: IntegrationProviderType
  entityType: SyntheticEntityType
  externalId: string
  canonicalId: string
  observedAt: string
  payload: Record<string, unknown>
}

const numberValue = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : Number(value ?? fallback) || fallback
const stringValue = (value: unknown, fallback = '') => typeof value === 'string' && value.length > 0 ? value : fallback
const providerRecordId = (raw: SyntheticRawRecord) => `synthetic:${raw.provider}:${raw.entityType}:${raw.externalId}`

function entityBase(scope: TenantScope, raw: SyntheticRawRecord) {
  const updatedAt = raw.observedAt
  return {
    id: providerRecordId(raw),
    ...scope,
    createdAt: updatedAt,
    updatedAt,
    canonicalEntityId: raw.canonicalId,
    metadata: { synthetic: true, source: raw.provider, externalId: raw.externalId },
    provenance: {
      provider: raw.provider,
      externalRecordId: raw.externalId,
      sourceEntityType: raw.entityType,
      sourceUpdatedAt: updatedAt,
      synchronizedAt: updatedAt,
    },
  }
}

export function normalizeSyntheticRecord(scope: TenantScope, raw: SyntheticRawRecord, synchronizedAt = raw.observedAt): NormalizedBusinessRecord {
  const payload = raw.payload
  const base = { ...entityBase(scope, raw), provenance: { ...entityBase(scope, raw).provenance, synchronizedAt } }
  switch (raw.entityType) {
    case 'customer': return { ...base, name: stringValue(payload.name, raw.canonicalId), email: stringValue(payload.email) || undefined, externalRefs: [raw.externalId] } as NormalizedCustomer
    case 'vendor': return { ...base, name: stringValue(payload.name, raw.canonicalId), email: stringValue(payload.email) || undefined, externalRefs: [raw.externalId] } as NormalizedVendor
    case 'employee': return { ...base, name: stringValue(payload.name, raw.canonicalId), email: stringValue(payload.email) || undefined, department: stringValue(payload.department, 'Operations'), role: stringValue(payload.role, 'Team member') } as NormalizedEmployee
    case 'product': return { ...base, name: stringValue(payload.name, raw.canonicalId), sku: stringValue(payload.sku) || undefined, active: payload.active !== false } as NormalizedProduct
    case 'invoice': return { ...base, customerId: stringValue(payload.customerId) || undefined, amount: numberValue(payload.amount), balance: numberValue(payload.balance, numberValue(payload.amount)), issuedAt: stringValue(payload.issuedAt, raw.observedAt), dueDate: stringValue(payload.dueDate, raw.observedAt), paidAt: stringValue(payload.paidAt) || undefined, status: (stringValue(payload.status, 'open') as NormalizedInvoice['status']) } as NormalizedInvoice
    case 'payment': return { ...base, customerId: stringValue(payload.customerId) || undefined, invoiceIds: Array.isArray(payload.invoiceIds) ? payload.invoiceIds.map(String) : [], amount: numberValue(payload.amount), paidAt: stringValue(payload.paidAt, raw.observedAt) } as NormalizedPayment
    case 'expense': return { ...base, vendorId: stringValue(payload.vendorId) || undefined, amount: numberValue(payload.amount), occurredAt: stringValue(payload.occurredAt, raw.observedAt), category: stringValue(payload.category) || undefined } as NormalizedExpense
    case 'lead': return { ...base, source: stringValue(payload.source) || undefined, firstResponseAt: stringValue(payload.firstResponseAt) || undefined, status: (stringValue(payload.status, 'new') as NormalizedLead['status']) } as NormalizedLead
    case 'deal': return { ...base, customerId: stringValue(payload.customerId) || undefined, ownerId: stringValue(payload.ownerId) || undefined, title: stringValue(payload.title, raw.canonicalId), amount: numberValue(payload.amount), stage: (stringValue(payload.stage, 'qualified') as NormalizedDeal['stage']), openedAt: stringValue(payload.openedAt, raw.observedAt), expectedCloseAt: stringValue(payload.expectedCloseAt) || undefined, closedAt: stringValue(payload.closedAt) || undefined, firstResponseHours: payload.firstResponseHours === undefined ? undefined : numberValue(payload.firstResponseHours), proposalTurnaroundHours: payload.proposalTurnaroundHours === undefined ? undefined : numberValue(payload.proposalTurnaroundHours) } as NormalizedDeal
    case 'communication': return { ...base, actorId: stringValue(payload.actorId) || undefined, customerId: stringValue(payload.customerId) || undefined, channel: (stringValue(payload.channel, 'email') as NormalizedCommunicationEvent['channel']), occurredAt: stringValue(payload.occurredAt, raw.observedAt), responseTimeHours: payload.responseTimeHours === undefined ? undefined : numberValue(payload.responseTimeHours) } as NormalizedCommunicationEvent
    case 'calendar_event': return { ...base, ownerId: stringValue(payload.ownerId) || undefined, title: stringValue(payload.title, 'Business event'), startsAt: stringValue(payload.startsAt, raw.observedAt), endsAt: stringValue(payload.endsAt, raw.observedAt), eventType: (stringValue(payload.eventType, 'meeting') as NormalizedCalendarEvent['eventType']) } as NormalizedCalendarEvent
    case 'document': return { ...base, name: stringValue(payload.name, raw.canonicalId), type: stringValue(payload.type, 'document'), sourceSystem: raw.provider, externalRef: raw.externalId } as NormalizedDocument
    case 'order': return { ...base, customerId: stringValue(payload.customerId) || undefined, orderNumber: stringValue(payload.orderNumber, raw.externalId), total: numberValue(payload.total), orderedAt: stringValue(payload.orderedAt, raw.observedAt), status: (stringValue(payload.status, 'open') as NormalizedOrder['status']), productIds: Array.isArray(payload.productIds) ? payload.productIds.map(String) : [] } as NormalizedOrder
    case 'inventory': return { ...base, product: stringValue(payload.product, raw.canonicalId), quantity: numberValue(payload.quantity), projectedDaysRemaining: numberValue(payload.projectedDaysRemaining), observedAt: stringValue(payload.observedAt, raw.observedAt) } as NormalizedInventoryRecord
    case 'subscription': return { ...base, vendor: stringValue(payload.vendor, raw.canonicalId), monthlyCost: numberValue(payload.monthlyCost), seatCount: payload.seatCount === undefined ? undefined : numberValue(payload.seatCount), utilizationPercent: payload.utilizationPercent === undefined ? undefined : numberValue(payload.utilizationPercent) } as NormalizedSubscription
    case 'task': return { ...base, assigneeId: stringValue(payload.assigneeId) || undefined, title: stringValue(payload.title, raw.canonicalId), status: (stringValue(payload.status, 'open') as NormalizedTask['status']), createdAt: stringValue(payload.createdAt, raw.observedAt), completedAt: stringValue(payload.completedAt) || undefined } as NormalizedTask
    case 'purchase_order': return { ...base, vendorId: stringValue(payload.vendorId) || undefined, orderNumber: stringValue(payload.orderNumber, raw.externalId), amount: numberValue(payload.amount), orderedAt: stringValue(payload.orderedAt, raw.observedAt), status: (stringValue(payload.status, 'submitted') as NormalizedPurchaseOrder['status']) } as NormalizedPurchaseOrder
  }
}

export function normalizeSyntheticRecords(scope: TenantScope, records: SyntheticRawRecord[], synchronizedAt = new Date().toISOString()): NormalizedBusinessRecord[] {
  return records.map((record) => normalizeSyntheticRecord(scope, record, synchronizedAt))
}

export function canonicalEntityKey(kind: string, id: string): string { return `${kind}:${id}` }

