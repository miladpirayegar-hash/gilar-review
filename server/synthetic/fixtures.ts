import type { IntegrationProviderType, TenantScope } from '../../shared/domain/models'
import type { SyntheticEntityType, SyntheticRawRecord } from '../normalization/synthetic'

export const syntheticProviders: IntegrationProviderType[] = [
  'quickbooks',
  'outlook',
  'gmail',
  'microsoft_calendar',
  'google_calendar',
  'google_drive',
  'onedrive',
  'slack',
  'hubspot',
  'salesforce',
  'shopify',
  'csv_excel',
]

export const northstarCompany = {
  name: 'Northstar Distribution Co.',
  legalName: 'Northstar Distribution Company, LLC',
  industry: 'B2B distribution',
  employeeCount: 42,
  annualRevenueRange: '$8–10M',
  customerCount: 250,
  supplierCount: 30,
  salesTeamSize: 6,
  adminOpsTeamSize: 4,
  historyStart: '2025-11-01T00:00:00.000Z',
  asOf: '2026-10-21T17:00:00.000Z',
}

const firstNames = ['Maya', 'Owen', 'Priya', 'Lucas', 'Nora', 'Evan', 'Ava', 'Noah', 'Lena', 'Theo', 'Sofia', 'Caleb']
const surnames = ['Chen', 'Brooks', 'Patel', 'Reyes', 'Morgan', 'Foster', 'Kim', 'Davis', 'Rivera', 'Singh', 'Bennett', 'Wright']
const monthDate = (index: number, day = 15) => new Date(Date.UTC(2025, 10 + index, day, 12)).toISOString()
const daysAfter = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * 86400000).toISOString()

function raw(provider: IntegrationProviderType, entityType: SyntheticEntityType, externalId: string, canonicalId: string, payload: Record<string, unknown>, observedAt = northstarCompany.asOf): SyntheticRawRecord {
  return { provider, entityType, externalId, canonicalId, payload, observedAt }
}

export interface SyntheticRawDataset {
  scope: TenantScope
  company: typeof northstarCompany
  records: SyntheticRawRecord[]
}

export function createNorthstarRawDataset(scope: TenantScope): SyntheticRawDataset {
  const records: SyntheticRawRecord[] = []

  for (let index = 1; index <= northstarCompany.customerCount; index += 1) {
    const canonicalId = index === 42 ? 'CUST-1042' : `CUST-${1000 + index}`
    const name = index === 42 ? 'Acme Manufacturing' : `${firstNames[index % firstNames.length]} ${surnames[(index * 3) % surnames.length]} ${index}`
    records.push(raw('quickbooks', 'customer', `qb-customer-${index}`, canonicalId, { name, email: `ap-${index}@northstar-demo.test` }, northstarCompany.historyStart))
    if (index <= 80) records.push(raw('hubspot', 'customer', `hs-company-${index}`, canonicalId, { name, email: `sales-${index}@northstar-demo.test` }, monthDate(9)))
    if (index <= 24) records.push(raw('salesforce', 'customer', `sf-account-${index}`, canonicalId, { name }, monthDate(10)))
  }

  for (let index = 1; index <= northstarCompany.supplierCount; index += 1) {
    const canonicalId = `VEND-${2000 + index}`
    const name = ['Meridian Industrial Supply', 'Harborline Packaging', 'Vector Safety Products', 'Summit Components'][index % 4] + ` ${index}`
    records.push(raw('quickbooks', 'vendor', `qb-vendor-${index}`, canonicalId, { name, email: `billing-${index}@supplier-demo.test` }, northstarCompany.historyStart))
  }

  const employeeIds: string[] = []
  for (let index = 1; index <= northstarCompany.employeeCount; index += 1) {
    const canonicalId = `EMP-${3000 + index}`
    employeeIds.push(canonicalId)
    const department = index <= 6 ? 'Sales' : index <= 10 ? 'Admin & Operations' : index <= 15 ? 'Customer Success' : 'Distribution'
    const role = index === 1 ? 'General Manager' : index <= 6 ? 'Account Executive' : index <= 10 ? 'Operations Coordinator' : 'Team member'
    const name = index <= firstNames.length ? `${firstNames[index - 1]} ${surnames[(index + 2) % surnames.length]}` : `Northstar teammate ${index}`
    records.push(raw('microsoft_365', 'employee', `m365-employee-${index}`, canonicalId, { name, department, role, email: `${name.toLowerCase().replaceAll(' ', '.')}@northstar-demo.test` }, northstarCompany.historyStart))
  }

  const productIds = ['SKU-ALPHA', 'SKU-BETA', 'SKU-GAMMA', 'SKU-DELTA', 'SKU-ECHO', 'SKU-FLEX', 'SKU-OMEGA', 'SKU-NOVA']
  const productNames = ['Alpha Safety Kit', 'Beta Industrial Gloves', 'Gamma Fastener Pack', 'Delta Shipping Carton', 'Echo Label Roll', 'Flex Pallet Wrap', 'Omega Hose Assembly', 'Nova Storage Bin']
  productIds.forEach((canonicalId, index) => {
    records.push(raw('quickbooks', 'product', `qb-item-${index + 1}`, canonicalId, { name: productNames[index], sku: canonicalId, active: true }, northstarCompany.historyStart))
    records.push(raw('shopify', 'product', `shopify-product-${index + 1}`, canonicalId, { name: productNames[index], sku: canonicalId, active: true }, monthDate(10)))
    records.push(raw('shopify', 'inventory', `shopify-inventory-${index + 1}`, canonicalId, { product: productNames[index], quantity: index === 2 ? 48 : 140 + index * 17, projectedDaysRemaining: index === 2 ? 12 : 38 + index * 4, observedAt: northstarCompany.asOf }, northstarCompany.asOf))
  })

  for (let index = 0; index < 60; index += 1) {
    const month = index % 12
    const canonicalCustomer = index % 5 === 0 ? 'CUST-1042' : `CUST-${1001 + (index % 80)}`
    const openedAt = monthDate(month, 4 + (index % 12))
    const currentPeriod = month >= 9
    const stage = currentPeriod ? (index % 4 === 0 ? 'won' : index % 3 === 0 ? 'lost' : 'proposal') : (index % 3 === 0 ? 'won' : index % 2 === 0 ? 'lost' : 'proposal')
    const firstResponseHours = currentPeriod ? 17 + (index % 8) : 3 + (index % 4)
    const proposalTurnaroundHours = currentPeriod ? 86 + (index % 18) : 48 + (index % 12)
    const ownerId = employeeIds[index % 6]
    const dealPayload = { customerId: canonicalCustomer, ownerId, title: `${productNames[index % productNames.length]} expansion`, amount: 18000 + (index % 7) * 4200, stage, openedAt, expectedCloseAt: daysAfter(openedAt, 28), closedAt: stage === 'proposal' ? undefined : daysAfter(openedAt, 31), firstResponseHours, proposalTurnaroundHours }
    records.push(raw('hubspot', 'lead', `hs-lead-${index + 1}`, `LEAD-${5000 + index}`, { source: index % 2 ? 'referral' : 'website', firstResponseAt: daysAfter(openedAt, firstResponseHours / 24), status: stage === 'won' ? 'won' : stage === 'lost' ? 'lost' : 'qualified' }, openedAt))
    records.push(raw('hubspot', 'deal', `hs-deal-${index + 1}`, `DEAL-${6000 + index}`, dealPayload, openedAt))
    if (index % 5 === 0) records.push(raw('salesforce', 'deal', `sf-deal-${index + 1}`, `DEAL-${6000 + index}`, dealPayload, openedAt))
  }

  for (let index = 0; index < 48; index += 1) {
    const month = index % 12
    const issuedAt = monthDate(month, 2 + (index % 18))
    const customerId = index % 4 === 0 ? 'CUST-1042' : `CUST-${1001 + (index % 45)}`
    const amount = 12400 + (index % 9) * 1850
    const overdue = month >= 9 && index % 4 !== 1
    const paid = !overdue && index % 5 !== 0
    records.push(raw('quickbooks', 'invoice', `qb-invoice-${index + 1}`, `INV-${7000 + index}`, { customerId, amount, balance: paid ? 0 : overdue ? amount : amount * .35, issuedAt, dueDate: daysAfter(issuedAt, 30), paidAt: paid ? daysAfter(issuedAt, 36 + (index % 8)) : undefined, status: paid ? 'paid' : overdue ? 'overdue' : 'open' }, issuedAt))
    if (paid) records.push(raw('quickbooks', 'payment', `qb-payment-${index + 1}`, `PAY-${8000 + index}`, { customerId, invoiceIds: [`INV-${7000 + index}`], amount, paidAt: daysAfter(issuedAt, 36 + (index % 8)) }, daysAfter(issuedAt, 36 + (index % 8))))
  }

  for (let index = 0; index < 96; index += 1) {
    const month = index % 12
    const occurredAt = monthDate(month, 3 + (index % 20))
    const vendorId = `VEND-${2001 + (index % northstarCompany.supplierCount)}`
    records.push(raw('quickbooks', 'expense', `qb-expense-${index + 1}`, `EXP-${9000 + index}`, { vendorId, amount: index % 7 === 0 ? 5200 : 900 + (index % 11) * 120, occurredAt, category: index % 7 === 0 ? 'Software subscription' : 'Distribution operations' }, occurredAt))
  }

  for (let index = 0; index < 72; index += 1) {
    const month = index % 12
    const orderedAt = monthDate(month, 6 + (index % 18))
    const customerId = index % 6 === 0 ? 'CUST-1042' : `CUST-${1001 + (index % 70)}`
    const productId = productIds[index % productIds.length]
    records.push(raw('shopify', 'order', `shopify-order-${index + 1}`, `ORD-${10000 + index}`, { customerId, orderNumber: `NS-${10000 + index}`, total: 6200 + (index % 9) * 930, orderedAt, status: index % 19 === 0 ? 'cancelled' : 'fulfilled', productIds: [productId] }, orderedAt))
  }

  const proposalDocs = ['FY25 proposal template', 'FY26 proposal template', 'Industrial pricing matrix', 'Acme case study', 'Distributor terms', 'Freight schedule', 'Approval checklist']
  for (let index = 0; index < 187; index += 1) {
    const provider = index % 3 === 0 ? 'google_drive' : index % 3 === 1 ? 'onedrive' : 'microsoft_365'
    const name = `${proposalDocs[index % proposalDocs.length]} ${index + 1}`
    records.push(raw(provider, 'document', `document-${index + 1}`, `DOC-${11000 + index}`, { name, type: index % 5 === 0 ? 'pricing' : 'proposal' }, monthDate(index % 12, 8 + (index % 12))))
  }

  for (let index = 0; index < 220; index += 1) {
    const month = index % 12
    const occurredAt = monthDate(month, 5 + (index % 20))
    const customerId = index % 7 === 0 ? 'CUST-1042' : `CUST-${1001 + (index % 55)}`
    const provider = index % 4 === 0 ? 'gmail' : index % 4 === 1 ? 'outlook' : index % 4 === 2 ? 'slack' : 'microsoft_365'
    const channel = provider === 'slack' ? 'slack' : 'email'
    const responseTimeHours = month >= 9 ? 17 + (index % 10) : 3 + (index % 5)
    records.push(raw(provider, 'communication', `${provider}-message-${index + 1}`, `COMM-${12000 + index}`, { actorId: employeeIds[index % employeeIds.length], customerId, channel, occurredAt, responseTimeHours }, occurredAt))
  }

  for (let index = 0; index < 72; index += 1) {
    const month = index % 12
    const startsAt = monthDate(month, 7 + (index % 17))
    const eventType = index % 5 === 0 ? 'admin' : index % 4 === 0 ? 'focus' : 'meeting'
    const provider = index % 2 === 0 ? 'microsoft_calendar' : 'google_calendar'
    records.push(raw(provider, 'calendar_event', `${provider}-event-${index + 1}`, `CAL-${13000 + index}`, { ownerId: employeeIds[index % 10], title: eventType === 'admin' ? 'Proposal data entry block' : eventType === 'focus' ? 'Proposal preparation' : 'Customer / supplier meeting', startsAt, endsAt: daysAfter(startsAt, 0.1), eventType }, startsAt))
  }

  for (let index = 0; index < 36; index += 1) {
    const orderedAt = monthDate(index % 12, 10 + (index % 10))
    records.push(raw('csv_excel', 'purchase_order', `excel-po-${index + 1}`, `PO-${14000 + index}`, { vendorId: `VEND-${2001 + (index % northstarCompany.supplierCount)}`, orderNumber: `PO-${14000 + index}`, amount: 1800 + (index % 9) * 410, orderedAt, status: index % 8 === 0 ? 'draft' : index % 5 === 0 ? 'received' : 'submitted' }, orderedAt))
  }

  for (let index = 0; index < 84; index += 1) {
    const created = monthDate(index % 12, 11 + (index % 9))
    records.push(raw('slack', 'task', `slack-task-${index + 1}`, `TASK-${15000 + index}`, { assigneeId: employeeIds[index % employeeIds.length], title: index % 3 === 0 ? 'Confirm shipment status' : index % 3 === 1 ? 'Copy PO attachment into ERP' : 'Reconcile customer owner', status: index % 6 === 0 ? 'blocked' : index % 4 === 0 ? 'open' : 'completed', createdAt: created, completedAt: index % 4 === 0 ? undefined : daysAfter(created, 1 + (index % 3)) }, created))
  }

  const subscriptions = [
    ['QuickBooks Online', 680, 8, 100],
    ['HubSpot Sales', 920, 6, 100],
    ['Salesforce Starter', 560, 4, 31],
    ['Slack Pro', 420, 42, 64],
    ['Proposal PDF tool', 210, 3, 28],
    ['Shared inbox add-on', 180, 4, 22],
    ['Google Workspace', 520, 18, 71],
    ['Microsoft 365', 760, 42, 88],
    ['Inventory plug-in', 290, 5, 35],
    ['Analytics workspace', 340, 2, 18],
  ] as const
  subscriptions.forEach(([vendor, monthlyCost, seatCount, utilizationPercent], index) => records.push(raw('quickbooks', 'subscription', `qb-subscription-${index + 1}`, `SUB-${16000 + index}`, { vendor, monthlyCost, seatCount, utilizationPercent }, northstarCompany.asOf)))

  return { scope, company: northstarCompany, records }
}

export function recordsByProvider(records: SyntheticRawRecord[]): Record<IntegrationProviderType, SyntheticRawRecord[]> {
  return syntheticProviders.reduce((result, provider) => {
    result[provider] = records.filter((record) => record.provider === provider)
    return result
  }, {} as Record<IntegrationProviderType, SyntheticRawRecord[]>)
}

