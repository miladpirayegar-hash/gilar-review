import type { BusinessMetric, DataCoverage, Evidence, FinancialMetric, Issue, Opportunity, RootCause, Signal, TenantScope } from '../../../shared/domain/models'
import { calculateROI, detectSignals, scoreOpportunity, type SignalInput } from '../../services/bi'
import type { QuickBooksReportResponse } from './types'
import type { NormalizedCustomer, NormalizedExpense, NormalizedInvoice, NormalizedPayment, NormalizedVendor } from '../../../shared/domain/models'

export interface QuickBooksAnalysis {
  metrics: FinancialMetric[]
  signals: Signal[]
  evidence: Evidence[]
  issues: Issue[]
  rootCauses: RootCause[]
  opportunities: Opportunity[]
  coverage: DataCoverage[]
}

export interface QuickBooksAnalysisInput {
  customers: NormalizedCustomer[]
  vendors: NormalizedVendor[]
  invoices: NormalizedInvoice[]
  payments: NormalizedPayment[]
  expenses: NormalizedExpense[]
  reports?: Record<string, QuickBooksReportResponse>
  synchronizedAt?: string
}

function sum(values: number[]): number { return Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100 }
function percentChange(current: number, baseline: number): number { return baseline === 0 ? 0 : ((current - baseline) / Math.abs(baseline)) * 100 }
function dateInRange(value: string, start: number, end: number): boolean { const time = new Date(value).getTime(); return time >= start && time < end }
function metric(scope: TenantScope, key: string, label: string, value: number, unit: FinancialMetric['unit'], origin: FinancialMetric['origin'], start: string, end: string, sourceRecordIds: string[], confidence: number): FinancialMetric { return { id: `financial_metric_${key}`, ...scope, createdAt: end, updatedAt: end, key, label, value: Math.round(value * 100) / 100, unit, origin, confidence, periodStart: start, periodEnd: end, sourceRecordIds } }
function businessMetric(scope: TenantScope, key: string, name: string, unit: BusinessMetric['unit'], now: string): BusinessMetric { return { id: `qb_business_metric_${key}`, ...scope, createdAt: now, updatedAt: now, key, name, category: key.includes('customer') ? 'customers' : key.includes('expense') || key.includes('margin') || key.includes('revenue') || key.includes('receivable') || key.includes('invoice') ? 'financial' : 'risk', unit, status: 'active' } }
function numberFrom(value: unknown): number | undefined { return typeof value === 'number' ? value : typeof value === 'string' && Number.isFinite(Number(value)) ? Number(value) : undefined }

function reportNumber(report: QuickBooksReportResponse | undefined, labels: string[]): number | undefined {
  const candidates: Array<{ label: string; value: number }> = []
  const visit = (value: unknown): number | undefined => {
    if (Array.isArray(value)) { for (const item of value) { const found = visit(item); if (found !== undefined) return found } return undefined }
    if (!value || typeof value !== 'object') return undefined
    const record = value as Record<string, unknown>
    if (Array.isArray(record.ColData)) {
      const columns = record.ColData.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
      const label = typeof columns[0]?.value === 'string' ? columns[0].value.toLowerCase() : ''
      const values = columns.map((column) => numberFrom(column.value)).filter((item): item is number => item !== undefined)
      if (values.length > 0) candidates.push({ label, value: values.at(-1)! })
    }
    for (const child of Object.values(record)) { const found = visit(child); if (found !== undefined) return found }
    return undefined
  }
  visit(report)
  for (const label of labels) {
    const exact = candidates.find((candidate) => candidate.label === label.toLowerCase())
    if (exact) return exact.value
  }
  for (const label of labels) {
    const partial = candidates.find((candidate) => candidate.label.includes(label.toLowerCase()))
    if (partial) return partial.value
  }
  return undefined
}

export function calculateQuickBooksAnalysis(scope: TenantScope, input: QuickBooksAnalysisInput, now = input.synchronizedAt ?? new Date().toISOString()): QuickBooksAnalysis {
  const end = new Date(now).getTime()
  const currentStartMs = end - 90 * 24 * 60 * 60 * 1000
  const baselineStartMs = end - 180 * 24 * 60 * 60 * 1000
  const currentStart = new Date(currentStartMs).toISOString()
  const baselineStart = new Date(baselineStartMs).toISOString()
  const invoices = input.invoices
  const currentInvoices = invoices.filter((invoice) => dateInRange(invoice.issuedAt, currentStartMs, end))
  const baselineInvoices = invoices.filter((invoice) => dateInRange(invoice.issuedAt, baselineStartMs, currentStartMs))
  const currentExpenses = input.expenses.filter((expense) => dateInRange(expense.occurredAt, currentStartMs, end))
  const baselineExpenses = input.expenses.filter((expense) => dateInRange(expense.occurredAt, baselineStartMs, currentStartMs))
  const currentRevenue = sum(currentInvoices.map((invoice) => invoice.amount))
  const baselineRevenue = sum(baselineInvoices.map((invoice) => invoice.amount))
  const expenses = sum(currentExpenses.map((expense) => expense.amount))
  const baselineExpenseTotal = sum(baselineExpenses.map((expense) => expense.amount))
  const grossProfit = currentRevenue - expenses
  const baselineGrossProfit = baselineRevenue - baselineExpenseTotal
  const margin = currentRevenue > 0 ? grossProfit / currentRevenue : 0
  const baselineMargin = baselineRevenue > 0 ? baselineGrossProfit / baselineRevenue : 0
  const overdueInvoices = invoices.filter((invoice) => invoice.status === 'overdue')
  const overdueAmount = sum(overdueInvoices.map((invoice) => invoice.balance))
  const currentOverdueAmount = sum(currentInvoices.filter((invoice) => invoice.status === 'overdue').map((invoice) => invoice.balance))
  const baselineOverdueAmount = sum(baselineInvoices.filter((invoice) => invoice.status === 'overdue').map((invoice) => invoice.balance))
  const receivables = sum(invoices.filter((invoice) => invoice.status !== 'paid').map((invoice) => invoice.balance))
  const averageInvoice = invoices.length ? sum(invoices.map((invoice) => invoice.amount)) / invoices.length : 0
  const customerTotals = new Map<string, number>()
  currentInvoices.forEach((invoice) => { if (invoice.customerId) customerTotals.set(invoice.customerId, (customerTotals.get(invoice.customerId) ?? 0) + invoice.amount) })
  const vendorTotals = new Map<string, number>()
  currentExpenses.forEach((expense) => { if (expense.vendorId) vendorTotals.set(expense.vendorId, (vendorTotals.get(expense.vendorId) ?? 0) + expense.amount) })
  const largestCustomerShare = currentRevenue > 0 ? Math.max(0, ...customerTotals.values()) / currentRevenue : 0
  const largestVendorShare = expenses > 0 ? Math.max(0, ...vendorTotals.values()) / expenses : 0
  const invoiceByExternalId = new Map(invoices.map((invoice) => [invoice.provenance.externalRecordId, invoice]))
  const paymentDelays = input.payments.flatMap((payment) => payment.invoiceIds.map((id) => { const invoice = invoiceByExternalId.get(id); if (!invoice) return undefined; return Math.max(0, (new Date(payment.paidAt).getTime() - new Date(invoice.dueDate).getTime()) / (24 * 60 * 60 * 1000)) }).filter((value): value is number => value !== undefined))
  const averagePaymentDelay = paymentDelays.length ? sum(paymentDelays) / paymentDelays.length : 0
  const reportedNetIncome = reportNumber(input.reports?.ProfitAndLoss, ['net income', 'net operating income'])
  const reportedRevenue = reportNumber(input.reports?.ProfitAndLoss, ['total income', 'total revenue'])
  const reportedExpenses = reportNumber(input.reports?.ProfitAndLoss, ['total expenses', 'total expense'])
  const reportedCash = reportNumber(input.reports?.BalanceSheet, ['cash and cash equivalents', 'cash on hand', 'total cash'])
  const sourceInvoiceIds = invoices.map((invoice) => invoice.provenance.externalRecordId)
  const sourceExpenseIds = input.expenses.map((expense) => expense.provenance.externalRecordId)
  const realmId = invoices[0]?.provenance.realmId ?? input.expenses[0]?.provenance.realmId
  const metrics: FinancialMetric[] = [
    metric(scope, 'revenue', 'Revenue', currentRevenue, 'currency', 'gilar_calculated', currentStart, now, sourceInvoiceIds, .9),
    metric(scope, 'revenue_growth', 'Revenue growth', percentChange(currentRevenue, baselineRevenue), 'percentage', 'gilar_calculated', currentStart, now, sourceInvoiceIds, .82),
    metric(scope, 'expenses', 'Expenses', expenses, 'currency', 'gilar_calculated', currentStart, now, sourceExpenseIds, .9),
    metric(scope, 'expense_growth', 'Expense growth', percentChange(expenses, baselineExpenseTotal), 'percentage', 'gilar_calculated', currentStart, now, sourceExpenseIds, .82),
    metric(scope, 'gross_profit', 'Gross profit', grossProfit, 'currency', 'gilar_calculated', currentStart, now, [...sourceInvoiceIds, ...sourceExpenseIds], .85),
    metric(scope, 'profit_margin', 'Profit margin', margin * 100, 'percentage', 'gilar_calculated', currentStart, now, [...sourceInvoiceIds, ...sourceExpenseIds], .85),
    metric(scope, 'accounts_receivable', 'Accounts receivable', receivables, 'currency', 'gilar_calculated', baselineStart, now, sourceInvoiceIds, .86),
    metric(scope, 'overdue_receivables', 'Overdue receivables', overdueAmount, 'currency', 'gilar_calculated', baselineStart, now, overdueInvoices.map((invoice) => invoice.provenance.externalRecordId), .93),
    metric(scope, 'overdue_invoice_count', 'Overdue invoice count', overdueInvoices.length, 'number', 'gilar_calculated', baselineStart, now, overdueInvoices.map((invoice) => invoice.provenance.externalRecordId), .93),
    metric(scope, 'average_invoice_value', 'Average invoice value', averageInvoice, 'currency', 'gilar_calculated', baselineStart, now, sourceInvoiceIds, .9),
    metric(scope, 'invoice_payment_delay', 'Average invoice payment delay', averagePaymentDelay, 'days', 'gilar_calculated', baselineStart, now, input.payments.map((payment) => payment.provenance.externalRecordId), paymentDelays.length ? .78 : .3),
    metric(scope, 'customer_concentration', 'Largest customer concentration', largestCustomerShare * 100, 'percentage', 'gilar_calculated', currentStart, now, sourceInvoiceIds, customerTotals.size ? .82 : .3),
    metric(scope, 'vendor_concentration', 'Largest vendor concentration', largestVendorShare * 100, 'percentage', 'gilar_calculated', currentStart, now, sourceExpenseIds, vendorTotals.size ? .82 : .3),
  ]
  if (reportedNetIncome !== undefined) metrics.push(metric(scope, 'net_income', 'Net income', reportedNetIncome, 'currency', 'quickbooks_reported', currentStart, now, ['report:ProfitAndLoss'], .97))
  if (reportedRevenue !== undefined) metrics.push(metric(scope, 'reported_revenue', 'QuickBooks reported revenue', reportedRevenue, 'currency', 'quickbooks_reported', currentStart, now, ['report:ProfitAndLoss'], .97))
  if (reportedExpenses !== undefined) metrics.push(metric(scope, 'reported_expenses', 'QuickBooks reported expenses', reportedExpenses, 'currency', 'quickbooks_reported', currentStart, now, ['report:ProfitAndLoss'], .97))
  if (reportedCash !== undefined) metrics.push(metric(scope, 'cash_balance', 'Cash balance', reportedCash, 'currency', 'quickbooks_reported', currentStart, now, ['report:BalanceSheet'], .97))

  const inputRows: Array<{ key: string; name: string; unit: BusinessMetric['unit']; current: number; baseline: number; observations: string[] }> = [
    { key: 'revenue_decline', name: 'Revenue trend', unit: 'currency', current: currentRevenue, baseline: baselineRevenue, observations: sourceInvoiceIds },
    { key: 'expense_acceleration', name: 'Expense trend', unit: 'currency', current: expenses, baseline: baselineExpenseTotal, observations: sourceExpenseIds },
    { key: 'overdue_receivables', name: 'Overdue receivables', unit: 'currency', current: currentOverdueAmount, baseline: baselineOverdueAmount, observations: overdueInvoices.map((invoice) => invoice.provenance.externalRecordId) },
    { key: 'margin_compression', name: 'Gross margin', unit: 'percentage', current: margin, baseline: baselineMargin, observations: [...sourceInvoiceIds, ...sourceExpenseIds] },
    { key: 'customer_concentration', name: 'Customer concentration', unit: 'percentage', current: largestCustomerShare, baseline: 0.25, observations: sourceInvoiceIds },
    { key: 'vendor_concentration', name: 'Vendor concentration', unit: 'percentage', current: largestVendorShare, baseline: 0.25, observations: sourceExpenseIds },
    { key: 'invoice_payment_delay', name: 'Invoice payment delay', unit: 'days', current: averagePaymentDelay, baseline: Math.max(1, averagePaymentDelay * .8), observations: input.payments.map((payment) => payment.provenance.externalRecordId) },
  ]
  const supportedRows = inputRows.filter((row) => row.observations.length > 0 && !(row.key.includes('concentration') && row.current === 0))
  const signalInputs: SignalInput[] = supportedRows.map((row) => ({ metric: businessMetric(scope, row.key, row.name, row.unit, now), currentValue: row.current, baselineValue: row.baseline, observedAt: now, observationIds: row.observations, sourceId: 'integration_quickbooks' }))
  const signals = detectSignals(scope, signalInputs, now)
  const evidence: Evidence[] = signals.map((signal) => {
    const row = supportedRows.find((candidate) => candidate.key === signal.metricId.replace('qb_business_metric_', ''))
    const sourceRecordIds = row?.observations ?? []
    const sourceEntityType = row?.key.includes('invoice') || row?.key.includes('receivable') || row?.key.includes('revenue') ? 'Invoice' : row?.key.includes('expense') || row?.key.includes('vendor') || row?.key.includes('margin') ? 'Purchase' : 'Payment'
    return { id: `evidence_${signal.id}`, ...scope, createdAt: now, updatedAt: now, sourceSystem: 'quickbooks', sourceRecordId: sourceRecordIds[0] ?? `analysis:${row?.key ?? signal.id}`, sourceRecordIds, sourceEntityType, metricId: signal.metricId, signalId: signal.id, observedValue: signal.currentValue, comparisonValue: signal.baselineValue, observedAt: now, periodStart: baselineStart, periodEnd: now, description: signal.description, strength: Math.min(1, signal.confidence / 100), relevance: .9, sourceRealmId: realmId, synchronizedAt: now, metadata: { sourceRecordIds } }
  })
  const issues: Issue[] = []
  const rootCauses: RootCause[] = []
  const opportunities: Opportunity[] = []
  signals.forEach((signal) => {
    const issueId = `issue_${signal.id}`
    const evidenceId = `evidence_${signal.id}`
    const rootCauseId = `root_cause_${signal.id}_unknown`
    const impact = signal.metricId.includes('overdue') ? overdueAmount * .1 : signal.metricId.includes('expense') ? Math.max(0, expenses - baselineExpenseTotal) * 4 * .15 : signal.metricId.includes('margin') ? Math.max(0, baselineMargin - margin) * currentRevenue * 4 : signal.metricId.includes('revenue') ? Math.max(0, baselineRevenue - currentRevenue) * 4 : 0
    issues.push({ id: issueId, ...scope, createdAt: now, updatedAt: now, title: signal.name, description: signal.description, severity: signal.severity, category: 'Financial', signalIds: [signal.id], evidenceIds: [evidenceId], rootCauseIds: [rootCauseId], impact: { estimatedAnnualValue: Math.round(impact), currency: 'USD', origin: impact > 0 ? 'estimate' : undefined }, confidence: signal.confidence / 100, status: 'open' })
    rootCauses.push({ id: rootCauseId, ...scope, createdAt: now, updatedAt: now, issueId, title: 'Root cause requires additional business data', explanation: 'Accounting data supports the observed symptom, but operational, CRM, or communication data is required to establish the cause.', contributingFactorIds: [], evidenceIds: [evidenceId], confidence: .45, order: 1, isPrimary: true, certainty: 'unknown' })
    const implementationDifficulty = signal.metricId.includes('concentration') ? 3 : 2
    opportunities.push({ id: `opportunity_${signal.id}`, ...scope, createdAt: now, updatedAt: now, issueId, title: signal.metricId.includes('overdue') ? 'Improve receivables collection' : signal.metricId.includes('expense') ? 'Review accelerating expense growth' : signal.metricId.includes('margin') ? 'Investigate margin compression' : signal.metricId.includes('concentration') ? 'Review concentration exposure' : 'Investigate revenue trend', category: 'Finance', summary: impact > 0 ? `Evidence-backed opportunity based on QuickBooks data. Directional impact is estimated at $${Math.round(impact).toLocaleString()} and should be validated before action.` : 'Accounting data shows the symptom, but additional business data is required to establish financial upside.', evidenceIds: [evidenceId], estimatedAnnualValue: Math.round(impact), estimatedSavings: signal.metricId.includes('expense') ? Math.round(impact) : 0, estimatedRevenueUpside: signal.metricId.includes('revenue') ? Math.round(impact) : 0, roi: impact > 0 ? calculateROI(impact, impact * .25) : 0, urgency: signal.severity === 'high' || signal.severity === 'critical' ? .9 : .65, confidence: signal.confidence / 100, implementationDifficulty, priorityScore: scoreOpportunity({ financialImpact: impact, confidence: signal.confidence / 100, urgency: signal.severity === 'high' || signal.severity === 'critical' ? .9 : .65, implementationDifficulty }), status: 'identified', sourceSystem: 'quickbooks', analysisPeriod: { start: baselineStart, end: now }, impactOrigin: impact > 0 ? 'estimate' : undefined, recommendedAction: signal.metricId.includes('overdue') ? 'Review aging accounts and validate a collections workflow.' : 'Connect an operational data source before treating the accounting symptom as a root cause.' })
  })

  const coverage: DataCoverage[] = [
    { id: 'coverage_financial', ...scope, createdAt: now, updatedAt: now, dimension: 'Financial Health', percentage: 95, status: 'available', confidence: .95, sourceIds: ['integration_quickbooks'] },
    { id: 'coverage_sales_customers', ...scope, createdAt: now, updatedAt: now, dimension: 'Sales & Customers', percentage: input.customers.length > 0 ? 52 : 18, status: input.customers.length > 0 ? 'partial' : 'insufficient', confidence: .62, sourceIds: input.customers.length > 0 ? ['integration_quickbooks'] : [] },
    { id: 'coverage_tools_costs', ...scope, createdAt: now, updatedAt: now, dimension: 'Tools & Costs', percentage: input.expenses.length > 0 ? 36 : 0, status: input.expenses.length > 0 ? 'partial' : 'insufficient', confidence: .5, sourceIds: input.expenses.length > 0 ? ['integration_quickbooks'] : [] },
    { id: 'coverage_operations', ...scope, createdAt: now, updatedAt: now, dimension: 'Operations', percentage: 0, status: 'insufficient', confidence: 0, sourceIds: [] },
    { id: 'coverage_people', ...scope, createdAt: now, updatedAt: now, dimension: 'People & Productivity', percentage: 0, status: 'insufficient', confidence: 0, sourceIds: [] },
    { id: 'coverage_marketing', ...scope, createdAt: now, updatedAt: now, dimension: 'Marketing & Growth', percentage: 0, status: 'insufficient', confidence: 0, sourceIds: [] },
    { id: 'coverage_risk', ...scope, createdAt: now, updatedAt: now, dimension: 'Risk & Compliance', percentage: 28, status: 'partial', confidence: .35, sourceIds: ['integration_quickbooks'] },
  ]
  return { metrics, signals, evidence, issues, rootCauses, opportunities, coverage }
}
