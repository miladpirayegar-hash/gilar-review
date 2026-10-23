import type {
  Agent,
  AgentRun,
  Approval,
  BusinessMetric,
  Evidence,
  Integration,
  Issue,
  MetricObservation,
  Opportunity,
  Outcome,
  Recommendation,
  ROIRecord,
  RootCause,
  Signal,
  TenantScope,
  Action,
  NormalizedBusinessRecord,
} from '../../shared/domain/models'
import type { BusinessHealthScoreDTO, DashboardDTO } from '../../shared/contracts/dto'
import type { AdvisoryContextDTO, AdvisoryOutputDTO, BusinessProfileDTO, MetricRegistryDTO, MetricSeriesPoint } from '../../shared/contracts/metrics'
import { calculateHealthScore, calculateROI, detectSignals, scoreOpportunity } from '../services/bi'
import { buildMetricRegistry } from '../services/metricRegistry'
import { createAdvisoryContext, createAdvisoryOutput } from '../advisory/service'
import { normalizeSyntheticRecords } from '../normalization/synthetic'
import { createNorthstarRawDataset, northstarCompany, recordsByProvider, syntheticProviders } from './fixtures'
import type { SyntheticRawRecord } from '../normalization/synthetic'

const BASELINE_START = '2026-05-01T00:00:00.000Z'
const CURRENT_START = '2026-08-01T00:00:00.000Z'
const AS_OF = northstarCompany.asOf
const baseRecord = (scope: TenantScope, id: string, timestamp = AS_OF) => ({ id, ...scope, createdAt: timestamp, updatedAt: timestamp })
const percent = (value: number) => `${Math.round(value * 100)}%`
const money = (value: number | undefined) => value === undefined ? 'Not enough data yet' : `$${Math.round(value).toLocaleString()}`
const change = (current: number | undefined, previous: number | undefined) => current === undefined || previous === undefined || previous === 0 ? undefined : `${current >= previous ? '+' : ''}${((current - previous) / Math.abs(previous) * 100).toFixed(1)}%`

function recordField(record: NormalizedBusinessRecord, fields: string[]): unknown {
  const values = record as unknown as Record<string, unknown>
  return fields.map((field) => values[field]).find((value) => value !== undefined)
}

function recordDate(record: NormalizedBusinessRecord, fields: string[]): string | undefined {
  const value = recordField(record, fields)
  return typeof value === 'string' ? value : undefined
}

function recordNumber(record: NormalizedBusinessRecord, fields: string[]): number | undefined {
  const value = recordField(record, fields)
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function inRange(value: string | undefined, start: string, end: string): boolean { return Boolean(value && value >= start && value <= end) }

function rangeSum(records: NormalizedBusinessRecord[], start: string, end: string, dateFields: string[], valueFields: string[], predicate?: (record: NormalizedBusinessRecord) => boolean): number {
  return records.filter((record) => (!predicate || predicate(record)) && inRange(recordDate(record, dateFields), start, end)).reduce((sum, record) => sum + (recordNumber(record, valueFields) ?? 0), 0)
}

function monthlySeries(records: NormalizedBusinessRecord[], start: string, months: number, dateFields: string[], valueFields: string[], predicate?: (record: NormalizedBusinessRecord) => boolean): MetricSeriesPoint[] {
  const startDate = new Date(start)
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + index, 1))
    const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
    const value = records.filter((record) => (!predicate || predicate(record)) && inRange(recordDate(record, dateFields), date.toISOString(), next.toISOString())).reduce((sum, record) => sum + (recordNumber(record, valueFields) ?? 0), 0)
    return { timestamp: date.toISOString(), label: date.toLocaleDateString('en-US', { month: 'short' }), value: Math.round(value * 100) / 100 }
  })
}

export interface SyntheticSourceSummary {
  provider: string
  displayName: string
  status: 'connected' | 'needs_attention' | 'disconnected' | 'error'
  mode: 'synthetic'
  permission: 'observe' | 'recommend'
  recordCount: number
  lastSyncedAt: string
  label: 'SYNTHETIC'
}

export interface SyntheticExplorerRow {
  id: string
  source: string
  entityType: string
  normalizedEntity: string
  canonicalEntityId?: string
  timestamp: string
  relatedSignalIds: string[]
  relatedOpportunityId?: string
  preview: Record<string, string | number>
}

export type SyntheticScenario = 'baseline' | 'low_confidence' | 'partial_coverage' | 'failed_action' | 'no_roi' | 'conflicting_evidence'
export type SyntheticBriefSection = 'Needs Attention' | 'Changes Since Last Brief' | 'Completed by Gilar' | 'Opportunities' | 'Watchlist'

export interface SyntheticBriefItem {
  id: string
  section: SyntheticBriefSection
  title: string
  detail: string
  priority: number
  tone: 'red' | 'yellow' | 'blue' | 'green' | 'gray'
  deepLink: string
  evidenceIds: string[]
  sourceLabels: string[]
  status?: 'open' | 'pending' | 'completed' | 'watching'
}

export interface SyntheticActivityEvent {
  id: string
  occurredAt: string
  title: string
  detail: string
  recordType: 'Signal' | 'Evidence' | 'Opportunity' | 'Recommendation' | 'Action' | 'Approval' | 'Outcome' | 'AgentRun'
  recordId: string
  status: 'observed' | 'proposed' | 'approved' | 'running' | 'completed' | 'failed' | 'pending'
}

export interface SyntheticAgentRunView {
  id: string
  status: AgentRun['status']
  startedAt?: string
  completedAt?: string
  title: string
  detail: string
  recordType: SyntheticActivityEvent['recordType']
  recordId: string
}

export interface SyntheticAgentActionView {
  id: string
  title: string
  status: Action['status']
  requestedAt: string
  approvedAt?: string
  completedAt?: string
  approvalRequired: boolean
}

export interface SyntheticAgentStats {
  assisted: number
  completedRuns: number
  failedRuns: number
  pendingApprovals: number
  completedActions: number
  hoursSaved: number
  measuredImpact: number
  estimatedImpact: number
  successRate: number
  directionalROI?: number
}

export interface SyntheticFeedback {
  id: string
  organizationId: string
  workspaceId: string
  screen: string
  entityType: string
  entityId?: string
  opportunityId?: string
  recommendationId?: string
  helpful: boolean
  comment?: string
  createdAt: string
}

export interface SyntheticTelemetryEvent {
  id: string
  organizationId: string
  workspaceId: string
  event: string
  screen: string
  entityType?: string
  entityId?: string
  occurredAt: string
}

export interface SyntheticConflict {
  id: string
  title: string
  detail: string
  sourceLabels: string[]
  confidence: number
  evidenceIds: string[]
}

export interface SyntheticEdgeState {
  key: string
  label: string
  description: string
  tone: 'info' | 'warning' | 'error'
  actionLabel?: string
  actionLink?: string
}

export interface SyntheticAgentView {
  agent: Agent
  activity: string[]
  tasks: string[]
  results: string[]
  businessImpact: string
  permissions: string[]
  currentTask: string
  stats: SyntheticAgentStats
  runs: SyntheticAgentRunView[]
  actions: SyntheticAgentActionView[]
  approvals: Approval[]
  timeline: SyntheticActivityEvent[]
}

export interface SyntheticSimulationSnapshot {
  demoOnly: true
  scenario: string
  status: 'baseline' | 'proposed' | 'approved' | 'running' | 'completed' | 'failed'
  actionStatus: Action['status'] | 'none'
  lifecycle: Array<'proposed' | 'awaiting_approval' | 'approved' | 'queued' | 'running' | 'completed'>
  elapsedDays: number
  targetDays: number
  actionId?: string
  interventionAt?: string
  before: { proposalMinutes: number; leadResponseHours: number; conversionRate: number }
  after?: { proposalMinutes: number; leadResponseHours: number; conversionRate: number }
  outcome?: Outcome
  roiRecord?: ROIRecord
  failureReason?: string
}

export interface SyntheticOverview {
  mode: 'synthetic'
  company: typeof northstarCompany
  sources: SyntheticSourceSummary[]
  records: { total: number; bySource: Record<string, number>; byEntityType: Record<string, number>; crossSourceEntityCount: number }
  metrics: BusinessMetric[]
  observations: MetricObservation[]
  signals: Signal[]
  evidence: Evidence[]
  issues: Issue[]
  rootCauses: RootCause[]
  opportunities: Opportunity[]
  recommendations: Recommendation[]
  health: BusinessHealthScoreDTO
  dashboard: DashboardDTO
  brief: { generatedAt: string; items: SyntheticBriefItem[]; whatChanged: string[]; whatMatters: string[]; newSignals: string[]; completedActions: string[]; emergingRisks: string[]; opportunities: string[]; agentResults: string[] }
  agents: SyntheticAgentView[]
  roiRecords: ROIRecord[]
  simulation: SyntheticSimulationSnapshot
  explorer: SyntheticExplorerRow[]
  scenario: SyntheticScenario
  briefItems: SyntheticBriefItem[]
  conflicts: SyntheticConflict[]
  edgeStates: SyntheticEdgeState[]
  metricRegistry: MetricRegistryDTO
  businessProfile: BusinessProfileDTO
  advisoryContext: AdvisoryContextDTO
  advisory: AdvisoryOutputDTO
}

interface TenantState {
  scope: TenantScope
  raw: SyntheticRawRecord[]
  records: NormalizedBusinessRecord[]
  simulation: SyntheticSimulationSnapshot
  scenario: SyntheticScenario
  agentRuns: AgentRun[]
  actions: Action[]
  approvals: Approval[]
  feedback: SyntheticFeedback[]
  telemetry: SyntheticTelemetryEvent[]
}

function scopeKey(scope: TenantScope): string { return `${scope.organizationId}:${scope.workspaceId}` }
function entityRecords(records: NormalizedBusinessRecord[], provider: string, entityType: string, limit = 16): string[] {
  const aliases: Record<string, string> = { communicationevent: 'communication', calendarevent: 'calendar_event', inventoryrecord: 'inventory', purchaseorder: 'purchase_order', lead: 'lead', deal: 'deal', document: 'document', payment: 'payment', invoice: 'invoice', expense: 'expense', task: 'task', employee: 'employee', order: 'order', vendor: 'vendor', customer: 'customer' }
  const normalizedType = aliases[entityType.toLowerCase()] ?? entityType.toLowerCase()
  return records.filter((record) => record.provenance.provider === provider && record.provenance.sourceEntityType.toLowerCase() === normalizedType).slice(0, limit).map((record) => record.id)
}
function evidence(scope: TenantScope, id: string, sourceSystem: Evidence['sourceSystem'], sourceRecordIds: string[], sourceEntityType: string, signalId: string, observedValue: number | string, comparisonValue: number | string | undefined, description: string, periodStart = CURRENT_START): Evidence {
  return { ...baseRecord(scope, id), sourceSystem, sourceRecordId: sourceRecordIds[0], sourceRecordIds, sourceEntityType, signalId, observedValue, comparisonValue, observedAt: AS_OF, periodStart, periodEnd: AS_OF, description, strength: .88, relevance: .9, synchronizedAt: AS_OF }
}
function metric(scope: TenantScope, id: string, key: string, name: string, category: BusinessMetric['category'], unit: BusinessMetric['unit']): BusinessMetric {
  return { ...baseRecord(scope, id), key, name, category, unit, status: 'active' }
}
function observationsFor(scope: TenantScope, metricId: string, currentValue: number, baselineValue: number, currentRecords: string[], baselineRecords: string[]): MetricObservation[] {
  return [
    { ...baseRecord(scope, `${metricId}_current`), metricId, value: currentValue, observedAt: AS_OF, periodStart: CURRENT_START, periodEnd: AS_OF, sourceRecordIds: currentRecords },
    { ...baseRecord(scope, `${metricId}_baseline`), metricId, value: baselineValue, observedAt: AS_OF, periodStart: BASELINE_START, periodEnd: '2026-07-31T23:59:59.000Z', sourceRecordIds: baselineRecords },
  ]
}
function issue(scope: TenantScope, id: string, title: string, description: string, category: string, signalIds: string[], evidenceIds: string[], rootCauseIds: string[], annualValue: number, confidence: number): Issue {
  return { ...baseRecord(scope, id), title, description, severity: confidence >= .88 ? 'high' : 'medium', category, signalIds, evidenceIds, rootCauseIds, impact: { estimatedAnnualValue: annualValue, estimatedRevenueUpside: annualValue, currency: 'USD', origin: 'estimate' }, confidence, status: 'open' }
}
function rootCause(scope: TenantScope, id: string, issueId: string, title: string, explanation: string, contributingFactorIds: string[], evidenceIds: string[], confidence: number, order: number, isPrimary: boolean, certainty: RootCause['certainty']): RootCause {
  return { ...baseRecord(scope, id), issueId, title, explanation, contributingFactorIds, evidenceIds, confidence, order, isPrimary, certainty }
}

function shiftIso(days: number, minutes = 0): string {
  return new Date(new Date(AS_OF).getTime() + (days * 86400000) + (minutes * 60000)).toISOString()
}

function seededAgentRuns(scope: TenantScope, records: NormalizedBusinessRecord[]): AgentRun[] {
  const dealIds = entityRecords(records, 'hubspot', 'Deal', 12)
  return Array.from({ length: 12 }, (_, index) => {
    const startedAt = shiftIso(-Math.max(1, 12 - index), 9 * 60 + 14 + index * 17)
    const completedAt = shiftIso(-Math.max(1, 12 - index), 9 * 60 + 17 + index * 17)
    const failed = index === 10
    return {
      ...baseRecord(scope, `agent_run_proposal_${index + 1}`, startedAt),
      agentId: 'agent_proposal_intelligence',
      status: failed ? 'failed' : 'completed',
      startedAt,
      completedAt: failed ? undefined : completedAt,
      inputReference: dealIds[index] ?? `deal-${index + 1}`,
      outputReference: failed ? undefined : `proposal-draft-${index + 1}`,
      errorMessage: failed ? 'Source pricing reference was stale; draft held for review.' : undefined,
    }
  })
}

function seededActions(scope: TenantScope): Action[] {
  return Array.from({ length: 5 }, (_, index) => {
    const requestedAt = shiftIso(-(index + 2), 10 * 60 + index * 11)
    return {
      ...baseRecord(scope, `action_proposal_completed_${index + 1}`, requestedAt),
      recommendationId: 'recommendation_opportunity_proposal_intelligence',
      agentRunId: `agent_run_proposal_${index + 1}`,
      proposedByUserId: 'user_milad',
      approvedByUserId: 'user_milad',
      status: 'completed' as const,
      targetSystem: 'internal' as const,
      operation: 'draft_proposal_for_review',
      requestedAt,
      approvedAt: shiftIso(-(index + 2), 10 * 60 + index * 11 + 2),
      completedAt: shiftIso(-(index + 2), 10 * 60 + index * 11 + 6),
      outcomeId: undefined,
      auditEventIds: [`audit_proposal_completed_${index + 1}`],
    }
  })
}

function seededApprovals(scope: TenantScope): Approval[] {
  const completed = Array.from({ length: 5 }, (_, index) => {
    const requestedAt = shiftIso(-(index + 2), 10 * 60 + index * 11)
    return {
      ...baseRecord(scope, `approval_proposal_completed_${index + 1}`, requestedAt),
      actionId: `action_proposal_completed_${index + 1}`,
      requestedByUserId: 'user_milad',
      reviewedByUserId: 'user_milad',
      status: 'approved' as const,
      requestedAt,
      reviewedAt: shiftIso(-(index + 2), 10 * 60 + index * 11 + 2),
    }
  })
  return [...completed, { ...baseRecord(scope, 'approval_proposal_pending'), actionId: 'action_proposal_pending', requestedByUserId: 'user_milad', status: 'pending', requestedAt: AS_OF }]
}

function createState(scope: TenantScope): TenantState {
  const raw = createNorthstarRawDataset(scope).records
  const records = normalizeSyntheticRecords(scope, raw, AS_OF)
  return {
    scope,
    raw,
    records,
    scenario: 'baseline',
    agentRuns: seededAgentRuns(scope, records),
    actions: [...seededActions(scope), { ...baseRecord(scope, 'action_proposal_pending'), recommendationId: 'recommendation_opportunity_proposal_intelligence', status: 'awaiting_approval', targetSystem: 'internal', operation: 'deploy_synthetic_proposal_intelligence', requestedAt: AS_OF, auditEventIds: [] }],
    approvals: seededApprovals(scope),
    feedback: [],
    telemetry: [],
    simulation: {
      demoOnly: true,
      scenario: 'Proposal Intelligence intervention',
      status: 'baseline',
      actionStatus: 'none',
      lifecycle: [],
      elapsedDays: 0,
      targetDays: 30,
      before: { proposalMinutes: 246, leadResponseHours: 17, conversionRate: .23 },
    },
  }
}

export function matchCrossSourceEntities(records: NormalizedBusinessRecord[]): Map<string, NormalizedBusinessRecord[]> {
  const groups = new Map<string, NormalizedBusinessRecord[]>()
  records.forEach((record) => {
    const keys = new Set<string>()
    if (record.canonicalEntityId) keys.add(record.canonicalEntityId)
    if ('customerId' in record && record.customerId) keys.add(record.customerId)
    if ('vendorId' in record && record.vendorId) keys.add(record.vendorId)
    if ('productIds' in record) record.productIds.forEach((productId) => keys.add(productId))
    keys.forEach((key) => {
      const list = groups.get(key) ?? []
      list.push(record)
      groups.set(key, list)
    })
  })
  return groups
}

export function rankSyntheticOpportunities(opportunities: Opportunity[]): Opportunity[] {
  return [...opportunities].sort((left, right) => right.priorityScore - left.priorityScore || right.confidence - left.confidence)
}

export function calculateSyntheticROI(outcome: Outcome, implementationCost: number): ROIRecord {
  return {
    ...baseRecord({ organizationId: outcome.organizationId, workspaceId: outcome.workspaceId }, `roi_${outcome.id}`),
    outcomeId: outcome.id,
    baselineMetric: `${outcome.baselineValue}`,
    postInterventionMetric: `${outcome.postInterventionValue}`,
    timeSavedHours: outcome.timeSavedHours ?? 0,
    costSaved: outcome.costSaved ?? 0,
    revenueGained: outcome.revenueGained ?? 0,
    annualizedImpact: outcome.annualizedImpact ?? 0,
    implementationCost,
    confidence: outcome.confidence,
    measurementPeriodStart: outcome.measurementStart,
    measurementPeriodEnd: outcome.measurementEnd,
    comparisonPeriodStart: new Date(new Date(outcome.measurementStart).getTime() - 90 * 86400000).toISOString(),
    comparisonPeriodEnd: outcome.measurementStart,
    measurementWindowDays: Math.max(1, Math.round((new Date(outcome.measurementEnd).getTime() - new Date(outcome.measurementStart).getTime()) / 86400000)),
    formula: `(measured labor savings + estimated incremental revenue) / implementation cost = ($${Math.round(outcome.costSaved ?? 0).toLocaleString()} + $${Math.round(outcome.revenueGained ?? 0).toLocaleString()}) / $${implementationCost.toLocaleString()}`,
    assumptions: [`Implementation cost is a directional synthetic estimate of $${implementationCost.toLocaleString()}.`, 'Revenue impact is estimated and not treated as realized revenue.', 'The comparison uses the same 30-day measurement window after approval.'],
    measuredComponents: [`${outcome.timeSavedHours ?? 0} hours saved`, `$${Math.round(outcome.costSaved ?? 0).toLocaleString()} labor savings`],
    estimatedComponents: [`$${Math.round(outcome.revenueGained ?? 0).toLocaleString()} incremental revenue impact`, `$${Math.round(outcome.annualizedImpact ?? 0).toLocaleString()} annualized impact`],
    sourceMetricIds: [outcome.metricId, 'metric_syn_conversion'],
  }
}

export class SyntheticDemoService {
  private readonly tenants = new Map<string, TenantState>()

  private tenant(scope: TenantScope): TenantState {
    const key = scopeKey(scope)
    let state = this.tenants.get(key)
    if (!state) { state = createState(scope); this.tenants.set(key, state) }
    return state
  }

  reset(scope: TenantScope): SyntheticOverview { this.tenants.set(scopeKey(scope), createState(scope)); return this.overview(scope) }

  setScenario(scope: TenantScope, scenario: SyntheticScenario): SyntheticOverview { const state = this.tenant(scope); state.scenario = scenario; return this.overview(scope) }

  recordFeedback(scope: TenantScope, input: Omit<SyntheticFeedback, 'id' | 'organizationId' | 'workspaceId' | 'createdAt'>): SyntheticFeedback {
    const state = this.tenant(scope)
    const feedback = { ...input, id: `feedback_${state.feedback.length + 1}`, organizationId: scope.organizationId, workspaceId: scope.workspaceId, createdAt: new Date().toISOString() }
    state.feedback.push(feedback)
    return structuredClone(feedback)
  }

  recordTelemetry(scope: TenantScope, input: Omit<SyntheticTelemetryEvent, 'id' | 'organizationId' | 'workspaceId' | 'occurredAt'>): SyntheticTelemetryEvent {
    const state = this.tenant(scope)
    const event = { ...input, id: `telemetry_${state.telemetry.length + 1}`, organizationId: scope.organizationId, workspaceId: scope.workspaceId, occurredAt: new Date().toISOString() }
    state.telemetry.push(event)
    return structuredClone(event)
  }

  private analysis(scope: TenantScope): Omit<SyntheticOverview, 'mode' | 'company' | 'sources' | 'records' | 'simulation' | 'explorer' | 'roiRecords'> {
    const state = this.tenant(scope)
    const scenario = state.scenario
    const records = state.records
    const sourceRecord = (provider: string, type: string, count = 8) => entityRecords(records, provider, type, count)
    const metrics: BusinessMetric[] = [
      metric(scope, 'metric_syn_conversion', 'conversion_decline', 'Sales conversion rate', 'sales', 'percentage'),
      metric(scope, 'metric_syn_response', 'response_time_increase', 'Lead response time', 'sales', 'duration'),
      metric(scope, 'metric_syn_overdue', 'overdue_receivables', 'Overdue receivables', 'financial', 'currency'),
      metric(scope, 'metric_syn_payment_delay', 'invoice_payment_delay', 'Average payment delay', 'financial', 'days'),
      metric(scope, 'metric_syn_admin', 'administrative_workload', 'Administrative workload', 'productivity', 'number'),
      metric(scope, 'metric_syn_software', 'software_spend_anomaly', 'Recurring software spend', 'tools', 'currency'),
      metric(scope, 'metric_syn_inventory', 'inventory_shortage', 'Projected stock cover', 'operations', 'days'),
      metric(scope, 'metric_syn_inactive', 'customer_inactivity', 'Inactive high-value accounts', 'customers', 'number'),
    ]
    const observations = [
      ...observationsFor(scope, 'metric_syn_conversion', .23, .31, sourceRecord('hubspot', 'Deal'), sourceRecord('hubspot', 'Deal', 20)),
      ...observationsFor(scope, 'metric_syn_response', 17, 3, sourceRecord('outlook', 'CommunicationEvent'), sourceRecord('outlook', 'CommunicationEvent', 20)),
      ...observationsFor(scope, 'metric_syn_overdue', 48000, 32000, sourceRecord('quickbooks', 'Invoice'), sourceRecord('quickbooks', 'Invoice', 20)),
      ...observationsFor(scope, 'metric_syn_payment_delay', 54, 39, sourceRecord('quickbooks', 'Payment'), sourceRecord('quickbooks', 'Payment', 20)),
      ...observationsFor(scope, 'metric_syn_admin', 62, 41, sourceRecord('csv_excel', 'PurchaseOrder'), sourceRecord('csv_excel', 'PurchaseOrder', 20)),
      ...observationsFor(scope, 'metric_syn_software', 16800, 12400, sourceRecord('quickbooks', 'Expense'), sourceRecord('quickbooks', 'Expense', 20)),
      ...observationsFor(scope, 'metric_syn_inventory', 12, 27, sourceRecord('shopify', 'InventoryRecord'), sourceRecord('shopify', 'InventoryRecord', 20)),
      ...observationsFor(scope, 'metric_syn_inactive', 31, 20, sourceRecord('hubspot', 'Deal'), sourceRecord('hubspot', 'Deal', 20)),
    ]
    const currentEnd = AS_OF
    const baselineEnd = '2026-07-31T23:59:59.000Z'
    const orders = state.records.filter((record) => record.provenance.sourceEntityType === 'order')
    const deals = state.records.filter((record) => record.provenance.sourceEntityType === 'deal')
    const payments = state.records.filter((record) => record.provenance.sourceEntityType === 'payment')
    const revenueCurrent = rangeSum(orders, CURRENT_START, currentEnd, ['orderedAt'], ['total'])
    const revenueBaseline = rangeSum(orders, BASELINE_START, baselineEnd, ['orderedAt'], ['total'])
    const pipelineCurrent = rangeSum(deals, CURRENT_START, currentEnd, ['openedAt'], ['amount'], (record) => ['qualified', 'proposal'].includes(String(recordField(record, ['stage']))))
    const pipelineBaseline = rangeSum(deals, BASELINE_START, baselineEnd, ['openedAt'], ['amount'], (record) => ['qualified', 'proposal'].includes(String(recordField(record, ['stage']))))
    const cashCurrent = rangeSum(payments, CURRENT_START, currentEnd, ['paidAt'], ['amount'])
    const cashBaseline = rangeSum(payments, BASELINE_START, baselineEnd, ['paidAt'], ['amount'])
    const derived = [
      { definition: metric(scope, 'metric_syn_revenue', 'revenue', 'Revenue', 'financial', 'currency'), current: revenueCurrent, baseline: revenueBaseline, records: orders },
      { definition: metric(scope, 'metric_syn_cash', 'cash_position', 'Cash position', 'financial', 'currency'), current: cashCurrent, baseline: cashBaseline, records: payments },
      { definition: metric(scope, 'metric_syn_pipeline', 'pipeline_value', 'Pipeline value', 'sales', 'currency'), current: pipelineCurrent, baseline: pipelineBaseline, records: deals },
    ]
    metrics.push(...derived.map((item) => item.definition))
    observations.push(...derived.flatMap((item) => observationsFor(scope, item.definition.id, item.current, item.baseline, item.records.slice(-20).map((record) => record.id), item.records.slice(0, 20).map((record) => record.id))))
    const metricInputs = metrics.map((item) => {
      const current = observations.find((row) => row.metricId === item.id && row.id.endsWith('_current'))!
      const baseline = observations.find((row) => row.metricId === item.id && row.id.endsWith('_baseline'))!
      const sourceByMetric: Record<string, string> = { metric_syn_conversion: 'integration_hubspot', metric_syn_response: 'integration_outlook', metric_syn_overdue: 'integration_quickbooks', metric_syn_payment_delay: 'integration_quickbooks', metric_syn_admin: 'integration_csv_excel', metric_syn_software: 'integration_quickbooks', metric_syn_inventory: 'integration_shopify', metric_syn_inactive: 'integration_hubspot', metric_syn_revenue: 'integration_shopify', metric_syn_cash: 'integration_quickbooks', metric_syn_pipeline: 'integration_hubspot' }
      return { metric: item, currentValue: current.value, baselineValue: baseline.value, observedAt: AS_OF, observationIds: [current.id, baseline.id], sourceId: sourceByMetric[item.id] }
    })
    const signals = detectSignals(scope, metricInputs, AS_OF)
    const signalId = (key: string) => signals.find((item) => item.id === `signal_${key}`)?.id ?? `signal_${key}`

    const evidenceRows: Evidence[] = [
      evidence(scope, 'evidence_sales_conversion', 'hubspot', sourceRecord('hubspot', 'Deal', 14), 'Deal', signalId('conversion_decline'), '23%', '31%', 'HubSpot conversion fell from 31% to 23% in the current three-month period.', CURRENT_START),
      evidence(scope, 'evidence_lead_response', 'outlook', sourceRecord('outlook', 'CommunicationEvent', 18), 'CommunicationEvent', signalId('response_time_increase'), '17 hours', '3 hours', 'Outlook median first response time grew from 3 hours to 17 hours for high-intent leads.', CURRENT_START),
      evidence(scope, 'evidence_proposal_calendar', 'microsoft_calendar', sourceRecord('microsoft_calendar', 'CalendarEvent', 12), 'CalendarEvent', signalId('response_time_increase'), '20 meetings', '14 meetings', 'Proposal-preparation meetings increased 42%, consuming selling time.', CURRENT_START),
      evidence(scope, 'evidence_fragmented_proposals', 'google_drive', sourceRecord('google_drive', 'Document', 18), 'Document', signalId('response_time_increase'), '187 files', '1 library', 'Proposal templates, pricing sheets, and case studies are fragmented across 187 files in Drive and OneDrive.', CURRENT_START),
      evidence(scope, 'evidence_followup_gap', 'hubspot', sourceRecord('hubspot', 'Lead', 12), 'Lead', signalId('conversion_decline'), '42%', '78%', 'Only 42% of high-intent leads received a second touch within five business days.', CURRENT_START),
      evidence(scope, 'evidence_overdue_balance', 'quickbooks', sourceRecord('quickbooks', 'Invoice', 18), 'Invoice', signalId('overdue_receivables'), '$48,000', '$32,000', 'QuickBooks shows $48,000 in overdue invoice balance, up from $32,000.', CURRENT_START),
      evidence(scope, 'evidence_payment_delay', 'quickbooks', sourceRecord('quickbooks', 'Payment', 16), 'Payment', signalId('invoice_payment_delay'), '54 days', '39 days', 'Average invoice payment time increased from 39 to 54 days.', CURRENT_START),
      evidence(scope, 'evidence_reminder_inconsistency', 'gmail', sourceRecord('gmail', 'CommunicationEvent', 12), 'CommunicationEvent', signalId('overdue_receivables'), '42%', '80%', 'Gmail shows reminder coverage on only 42% of overdue accounts, with no consistent owner sequence.', CURRENT_START),
      evidence(scope, 'evidence_owner_hygiene', 'hubspot', sourceRecord('hubspot', 'Deal', 10), 'Deal', signalId('overdue_receivables'), '7 accounts', '0 accounts', 'Seven overdue accounts have either a blank or stale CRM owner.', CURRENT_START),
      evidence(scope, 'evidence_po_attachments', 'outlook', sourceRecord('outlook', 'CommunicationEvent', 16), 'CommunicationEvent', signalId('administrative_workload'), '37 POs/month', '12 POs/month', 'Outlook contains recurring supplier PO attachments that are re-keyed into the spreadsheet queue.', CURRENT_START),
      evidence(scope, 'evidence_manual_po_entry', 'csv_excel', sourceRecord('csv_excel', 'PurchaseOrder', 16), 'PurchaseOrder', signalId('administrative_workload'), '46 fields/week', '18 fields/week', 'The Excel purchasing tracker records the same order, vendor, and shipment fields manually.', CURRENT_START),
      evidence(scope, 'evidence_admin_calendar', 'google_calendar', sourceRecord('google_calendar', 'CalendarEvent', 12), 'CalendarEvent', signalId('administrative_workload'), '18 hrs/month', '7 hrs/month', 'Calendar blocks labeled data entry and reconciliation grew to 18 hours per month.', CURRENT_START),
      evidence(scope, 'evidence_shipment_slack', 'slack', sourceRecord('slack', 'CommunicationEvent', 14), 'CommunicationEvent', signalId('administrative_workload'), '28 threads', '9 threads', 'Slack has 28 shipment-status threads asking for information already present in email attachments.', CURRENT_START),
      evidence(scope, 'evidence_software_spend', 'quickbooks', sourceRecord('quickbooks', 'Expense', 16), 'Expense', signalId('software_spend_anomaly'), '$16,800/year', '$12,400/year', 'Recurring software charges rose while three overlapping products have low activity.', CURRENT_START),
      evidence(scope, 'evidence_tool_utilization', 'slack', sourceRecord('slack', 'Task', 10), 'Task', signalId('software_spend_anomaly'), '18–35%', '70%', 'Slack activity and team records show three tools with seat utilization below 35%.', CURRENT_START),
      evidence(scope, 'evidence_team_overlap', 'microsoft_365', sourceRecord('microsoft_365', 'Employee', 10), 'Employee', signalId('software_spend_anomaly'), '3 overlaps', '0 overlaps', 'The 42-person team has overlapping CRM, inbox, and proposal utilities with unclear ownership.', CURRENT_START),
      evidence(scope, 'evidence_shopify_demand', 'shopify', sourceRecord('shopify', 'Order', 18), 'Order', signalId('inventory_shortage'), '+26%', '+8%', 'Shopify order volume for Beta Industrial Gloves rose 26% while replenishment cadence stayed flat.', CURRENT_START),
      evidence(scope, 'evidence_inventory_cover', 'shopify', sourceRecord('shopify', 'InventoryRecord', 8), 'InventoryRecord', signalId('inventory_shortage'), '12 days', '27 days', 'Shopify inventory projects only 12 days of cover for Beta Industrial Gloves.', CURRENT_START),
      evidence(scope, 'evidence_qb_sku_sales', 'quickbooks', sourceRecord('quickbooks', 'Invoice', 14), 'Invoice', signalId('inventory_shortage'), '-18%', '+4%', 'QuickBooks revenue for the affected SKU is down 18% in the latest month because orders are being delayed.', CURRENT_START),
      evidence(scope, 'evidence_stockout_discussion', 'slack', sourceRecord('slack', 'CommunicationEvent', 10), 'CommunicationEvent', signalId('inventory_shortage'), '9 mentions', '1 mention', 'Slack contains nine recent stock-shortage discussions from sales and warehouse staff.', CURRENT_START),
    ]
    const evidenceById = (id: string) => evidenceRows.find((item) => item.id === id)!
    const rootCauses: RootCause[] = [
      rootCause(scope, 'root_cause_slow_proposals', 'issue_sales_conversion_decline', 'Proposal workflow is too slow', 'The sales team is spending more time assembling proposal context while response time is rising.', ['factor_manual_proposal_research'], ['evidence_lead_response', 'evidence_proposal_calendar', 'evidence_fragmented_proposals'], .92, 1, true, 'inferred'),
      rootCause(scope, 'root_cause_fragmented_knowledge', 'issue_sales_conversion_decline', 'Proposal knowledge is fragmented', 'Past proposals, pricing, and case studies are distributed across 187 files rather than a searchable approved library.', [], ['evidence_fragmented_proposals'], .96, 2, false, 'observed'),
      rootCause(scope, 'root_cause_followup_gap', 'issue_sales_conversion_decline', 'Follow-up ownership is inconsistent', 'The lower second-touch rate is consistent with a workflow gap, but individual rep intent is not directly observable.', ['factor_manual_proposal_research'], ['evidence_followup_gap'], .78, 3, false, 'inferred'),
      rootCause(scope, 'root_cause_receivables_followup', 'issue_receivables_deterioration', 'Overdue follow-up is not consistently triggered', 'Accounting data confirms the balance and payment delay; email activity suggests reminders are inconsistent.', [], ['evidence_overdue_balance', 'evidence_payment_delay', 'evidence_reminder_inconsistency'], .9, 1, true, 'inferred'),
      rootCause(scope, 'root_cause_stale_owners', 'issue_receivables_deterioration', 'Account ownership data is stale', 'Seven overdue accounts lack a reliable owner, so the accountable recipient for a reminder is unknown.', [], ['evidence_owner_hygiene'], .84, 2, false, 'observed'),
      rootCause(scope, 'root_cause_manual_transfer', 'issue_admin_fragmented_workflow', 'Purchase orders are transferred by hand', 'Supplier email attachments are manually copied into the Excel purchasing tracker and then rechecked in Slack.', [], ['evidence_po_attachments', 'evidence_manual_po_entry'], .94, 1, true, 'observed'),
      rootCause(scope, 'root_cause_shipment_fragmentation', 'issue_admin_fragmented_workflow', 'Shipment status is fragmented across channels', 'The team uses Slack to chase status that is not linked to the original supplier document.', [], ['evidence_shipment_slack', 'evidence_admin_calendar'], .82, 2, false, 'inferred'),
      rootCause(scope, 'root_cause_tool_overlap', 'issue_tool_cost_leakage', 'Overlapping tools are under-used', 'Recurring charges continue for tools with low activity and overlapping responsibilities.', [], ['evidence_software_spend', 'evidence_tool_utilization', 'evidence_team_overlap'], .88, 1, true, 'inferred'),
      rootCause(scope, 'root_cause_replenishment_cadence', 'issue_inventory_stockout_risk', 'Replenishment cadence misses demand changes', 'Shopify demand is increasing for a selected SKU while inventory and accounting signals show exposure.', [], ['evidence_shopify_demand', 'evidence_inventory_cover', 'evidence_qb_sku_sales'], .9, 1, true, 'inferred'),
      rootCause(scope, 'root_cause_stockout_visibility', 'issue_inventory_stockout_risk', 'Stockout risk is discussed before it is measured', 'Slack contains the warnings, but there is no shared alert tied to projected days of cover.', [], ['evidence_stockout_discussion'], .8, 2, false, 'observed'),
    ]
    const issues: Issue[] = [
      issue(scope, 'issue_sales_conversion_decline', 'Sales conversion decline', 'Conversion fell from 31% to 23% while proposal preparation and response time expanded.', 'Sales & Customers', [signalId('conversion_decline'), signalId('response_time_increase')], ['evidence_sales_conversion', 'evidence_lead_response', 'evidence_proposal_calendar', 'evidence_fragmented_proposals', 'evidence_followup_gap'], ['root_cause_slow_proposals', 'root_cause_fragmented_knowledge', 'root_cause_followup_gap'], 82000, .91),
      issue(scope, 'issue_receivables_deterioration', 'Receivables are aging', 'Overdue balances and payment delay are rising while reminder coverage is inconsistent.', 'Financial Health', [signalId('overdue_receivables'), signalId('invoice_payment_delay')], ['evidence_overdue_balance', 'evidence_payment_delay', 'evidence_reminder_inconsistency', 'evidence_owner_hygiene'], ['root_cause_receivables_followup', 'root_cause_stale_owners'], 48000, .9),
      issue(scope, 'issue_admin_fragmented_workflow', 'Admin work is fragmented', 'Purchase orders and shipment questions move manually across email, spreadsheets, calendars, and Slack.', 'Operations', [signalId('administrative_workload')], ['evidence_po_attachments', 'evidence_manual_po_entry', 'evidence_admin_calendar', 'evidence_shipment_slack'], ['root_cause_manual_transfer', 'root_cause_shipment_fragmentation'], 28000, .9),
      issue(scope, 'issue_tool_cost_leakage', 'Software cost leakage', 'Recurring software spend is rising while several overlapping tools show low activity.', 'Tools & Subscriptions', [signalId('software_spend_anomaly')], ['evidence_software_spend', 'evidence_tool_utilization', 'evidence_team_overlap'], ['root_cause_tool_overlap'], 19800, .86),
      issue(scope, 'issue_inventory_stockout_risk', 'Inventory stockout risk', 'Demand is rising for selected products while stock cover is falling and teams are already reporting shortages.', 'Operations', [signalId('inventory_shortage')], ['evidence_shopify_demand', 'evidence_inventory_cover', 'evidence_qb_sku_sales', 'evidence_stockout_discussion'], ['root_cause_replenishment_cadence', 'root_cause_stockout_visibility'], 31000, .88),
    ]

    if (scenario === 'low_confidence') {
      const salesIssue = issues.find((item) => item.id === 'issue_sales_conversion_decline')
      if (salesIssue) Object.assign(salesIssue, { confidence: .54, severity: 'medium' as const })
      rootCauses.filter((item) => item.issueId === 'issue_sales_conversion_decline').forEach((item) => Object.assign(item, { confidence: Math.min(item.confidence, .58), certainty: 'inferred' as const }))
    }

    const opportunityInputs: Array<{
      id: string; issueId: string; rootCauseId?: string; title: string; category: string; summary: string; evidenceIds: string[]; estimatedAnnualValue: number; estimatedSavings: number; estimatedRevenueUpside: number; urgency: number; confidence: number; implementationDifficulty: number; recommendedAction: string; sourceSystem: Opportunity['sourceSystem']; analysisPeriod: { start: string; end: string }; impactOrigin: Opportunity['impactOrigin']
    }> = [
      { id: 'opportunity_proposal_intelligence', issueId: 'issue_sales_conversion_decline', rootCauseId: 'root_cause_slow_proposals', title: 'Automate proposal generation', category: 'Growth', summary: 'Create a searchable proposal workflow that gathers approved pricing, context, and examples before a seller reviews the draft.', evidenceIds: ['evidence_sales_conversion', 'evidence_lead_response', 'evidence_proposal_calendar', 'evidence_fragmented_proposals'], estimatedAnnualValue: 82000, estimatedSavings: 16400, estimatedRevenueUpside: 82000, urgency: .95, confidence: .91, implementationDifficulty: 2, recommendedAction: 'Deploy Proposal Intelligence in draft-only mode and measure proposal time for 30 days.', sourceSystem: 'hubspot', analysisPeriod: { start: CURRENT_START, end: AS_OF }, impactOrigin: 'estimate' },
      { id: 'opportunity_receivables_followup', issueId: 'issue_receivables_deterioration', rootCauseId: 'root_cause_receivables_followup', title: 'Automate receivables follow-up', category: 'Finance', summary: 'Route overdue account reminders to the right owner using QuickBooks aging and communication history.', evidenceIds: ['evidence_overdue_balance', 'evidence_payment_delay', 'evidence_reminder_inconsistency', 'evidence_owner_hygiene'], estimatedAnnualValue: 48000, estimatedSavings: 0, estimatedRevenueUpside: 48000, urgency: .94, confidence: .9, implementationDifficulty: 2, recommendedAction: 'Prepare reminder drafts for owner approval; never send automatically.', sourceSystem: 'quickbooks', analysisPeriod: { start: CURRENT_START, end: AS_OF }, impactOrigin: 'estimate' },
      { id: 'opportunity_po_automation', issueId: 'issue_admin_fragmented_workflow', rootCauseId: 'root_cause_manual_transfer', title: 'Automate PO and order data entry', category: 'Operations', summary: 'Extract supplier PO fields once, match them to the vendor, and route exceptions to operations.', evidenceIds: ['evidence_po_attachments', 'evidence_manual_po_entry', 'evidence_admin_calendar'], estimatedAnnualValue: 28000, estimatedSavings: 28000, estimatedRevenueUpside: 0, urgency: .82, confidence: .9, implementationDifficulty: 2, recommendedAction: 'Deploy Document Automation for attachment extraction with exception review.', sourceSystem: 'csv_excel', analysisPeriod: { start: CURRENT_START, end: AS_OF }, impactOrigin: 'estimate' },
      { id: 'opportunity_saas_consolidation', issueId: 'issue_tool_cost_leakage', rootCauseId: 'root_cause_tool_overlap', title: 'Consolidate overlapping SaaS tools', category: 'Tools & Subscriptions', summary: 'Review low-utilization CRM, proposal, inbox, and analytics subscriptions before renewal.', evidenceIds: ['evidence_software_spend', 'evidence_tool_utilization', 'evidence_team_overlap'], estimatedAnnualValue: 19800, estimatedSavings: 19800, estimatedRevenueUpside: 0, urgency: .7, confidence: .86, implementationDifficulty: 1, recommendedAction: 'Create a renewal review with seat utilization and overlapping capabilities attached.', sourceSystem: 'quickbooks', analysisPeriod: { start: CURRENT_START, end: AS_OF }, impactOrigin: 'estimate' },
      { id: 'opportunity_lead_response', issueId: 'issue_sales_conversion_decline', rootCauseId: 'root_cause_followup_gap', title: 'Improve lead-response workflow', category: 'Growth', summary: 'Give high-intent leads a consistent first and second touch while proposal work is underway.', evidenceIds: ['evidence_sales_conversion', 'evidence_lead_response', 'evidence_followup_gap'], estimatedAnnualValue: 38000, estimatedSavings: 7200, estimatedRevenueUpside: 38000, urgency: .88, confidence: .84, implementationDifficulty: 2, recommendedAction: 'Configure an approval-based lead response queue for high-intent opportunities.', sourceSystem: 'hubspot', analysisPeriod: { start: CURRENT_START, end: AS_OF }, impactOrigin: 'estimate' },
      { id: 'opportunity_inventory_forecasting', issueId: 'issue_inventory_stockout_risk', rootCauseId: 'root_cause_replenishment_cadence', title: 'Improve inventory forecasting', category: 'Operations', summary: 'Combine Shopify demand, QuickBooks sales, and current stock cover into an early replenishment signal.', evidenceIds: ['evidence_shopify_demand', 'evidence_inventory_cover', 'evidence_qb_sku_sales'], estimatedAnnualValue: 31000, estimatedSavings: 0, estimatedRevenueUpside: 31000, urgency: .92, confidence: .88, implementationDifficulty: 3, recommendedAction: 'Set a 21-day cover alert with a weekly owner review.', sourceSystem: 'shopify', analysisPeriod: { start: CURRENT_START, end: AS_OF }, impactOrigin: 'estimate' },
      { id: 'opportunity_knowledge_search', issueId: 'issue_sales_conversion_decline', rootCauseId: 'root_cause_fragmented_knowledge', title: 'Create searchable company knowledge', category: 'Productivity', summary: 'Index approved proposal, pricing, and case-study documents with source links and freshness dates.', evidenceIds: ['evidence_fragmented_proposals', 'evidence_proposal_calendar'], estimatedAnnualValue: 24000, estimatedSavings: 24000, estimatedRevenueUpside: 0, urgency: .76, confidence: .9, implementationDifficulty: 2, recommendedAction: 'Build an approved document index with permission-aware retrieval.', sourceSystem: 'google_drive', analysisPeriod: { start: CURRENT_START, end: AS_OF }, impactOrigin: 'estimate' },
      { id: 'opportunity_shipment_updates', issueId: 'issue_admin_fragmented_workflow', rootCauseId: 'root_cause_shipment_fragmentation', title: 'Automate shipment-status communication', category: 'Customer Experience', summary: 'Turn supplier and warehouse status into a shared update before the same question appears in Slack.', evidenceIds: ['evidence_shipment_slack', 'evidence_po_attachments'], estimatedAnnualValue: 18500, estimatedSavings: 18500, estimatedRevenueUpside: 0, urgency: .73, confidence: .82, implementationDifficulty: 2, recommendedAction: 'Draft internal and customer-facing shipment updates from approved source documents.', sourceSystem: 'slack', analysisPeriod: { start: CURRENT_START, end: AS_OF }, impactOrigin: 'estimate' },
      { id: 'opportunity_owner_hygiene', issueId: 'issue_receivables_deterioration', rootCauseId: 'root_cause_stale_owners', title: 'Repair account ownership hygiene', category: 'Customers', summary: 'Resolve blank and stale CRM ownership so receivables and follow-up tasks have an accountable owner.', evidenceIds: ['evidence_owner_hygiene', 'evidence_reminder_inconsistency'], estimatedAnnualValue: 16000, estimatedSavings: 0, estimatedRevenueUpside: 16000, urgency: .8, confidence: .84, implementationDifficulty: 1, recommendedAction: 'Run an owner exception report and route changes for approval.', sourceSystem: 'hubspot', analysisPeriod: { start: CURRENT_START, end: AS_OF }, impactOrigin: 'estimate' },
    ]
    const opportunities = rankSyntheticOpportunities(opportunityInputs.map((item, index) => {
      const implementationCost = [15700, 9000, 7000, 3500, 7200, 11000, 6000, 5000, 3500][index] ?? 6000
      const priorityScore = scoreOpportunity({ financialImpact: item.estimatedAnnualValue, confidence: item.confidence, urgency: item.urgency, implementationDifficulty: item.implementationDifficulty })
      return { ...baseRecord(scope, item.id), ...item, roi: calculateROI(item.estimatedAnnualValue, implementationCost), priorityScore, status: index < 5 ? 'prioritized' : 'identified' } as Opportunity
    }))
    const recommendations: Recommendation[] = opportunities.map((opportunity) => ({
      ...baseRecord(scope, `recommendation_${opportunity.id}`), opportunityId: opportunity.id, solutionId: `solution_${opportunity.id}`, rationale: opportunity.summary, evidenceIds: opportunity.evidenceIds, expectedBenefit: opportunity.recommendedAction ?? 'Review the linked evidence and approve the next step.', expectedROI: opportunity.roi, estimatedTimeSavedHours: opportunity.estimatedSavings > 0 ? Math.round(opportunity.estimatedSavings / 42) : 0, implementationComplexity: opportunity.implementationDifficulty <= 1 ? 'low' : opportunity.implementationDifficulty === 2 ? 'medium' : 'high', confidence: opportunity.confidence, risks: ['Synthetic estimate; validate with a controlled rollout and owner approval.'], requiredPermissions: ['observe', 'recommend'], approvalRequired: true, status: 'ready', aiProvenance: { provider: 'gilar-deterministic', model: 'synthetic-rules-v1', generatedAt: AS_OF, promptVersion: 'synthetic-northstar-v1', confidence: opportunity.confidence, sourceEvidenceIds: opportunity.evidenceIds },
    }))
    const healthBase = calculateHealthScore([
      { key: 'financial', label: 'Financial Health', score: 71, weight: .18, contributingSignalIds: [signalId('overdue_receivables'), signalId('invoice_payment_delay')] },
      { key: 'sales_customers', label: 'Sales & Customers', score: 61, weight: .2, contributingSignalIds: [signalId('conversion_decline'), signalId('response_time_increase')] },
      { key: 'operations', label: 'Operations', score: 64, weight: .15, contributingSignalIds: [signalId('inventory_shortage'), signalId('administrative_workload')] },
      { key: 'people_productivity', label: 'People & Productivity', score: 58, weight: .12, contributingSignalIds: [signalId('administrative_workload')] },
      { key: 'marketing_growth', label: 'Marketing & Growth', score: 74, weight: .1, contributingSignalIds: [signalId('conversion_decline')] },
      { key: 'tools_subscriptions', label: 'Tools & Subscriptions', score: 55, weight: .08, contributingSignalIds: [signalId('software_spend_anomaly')] },
      { key: 'risk_compliance', label: 'Risk & Compliance', score: 79, weight: .09, contributingSignalIds: [] },
      { key: 'market_opportunities', label: 'Market Opportunities', score: 76, weight: .08, contributingSignalIds: [signalId('inventory_shortage')] },
    ])
    const coverage = [
      ['Financial Health', 96, 4], ['Sales & Customers', 91, 5], ['Operations', 88, 5], ['People & Productivity', 84, 3], ['Marketing & Growth', 78, 2], ['Tools & Subscriptions', 93, 4], ['Risk & Compliance', 66, 1], ['Market Opportunities', 81, 3],
    ].map(([dimension, percentage, evidenceCount]) => ({ dimension: String(dimension), percentage: scenario === 'partial_coverage' && String(dimension) === 'Risk & Compliance' ? 28 : Number(percentage), status: scenario === 'partial_coverage' && String(dimension) === 'Risk & Compliance' ? 'partial' as const : scenario === 'low_confidence' ? 'available' as const : 'available' as const, confidence: scenario === 'low_confidence' ? .54 : scenario === 'partial_coverage' && String(dimension) === 'Risk & Compliance' ? .31 : .84, evidenceCount: Number(evidenceCount), trend: 'down' as const }))
    const health: BusinessHealthScoreDTO = { ...healthBase, coverage }
    const overdueCurrent = observations.find((row) => row.metricId === 'metric_syn_overdue' && row.id.endsWith('_current'))?.value
    const overdueBaseline = observations.find((row) => row.metricId === 'metric_syn_overdue' && row.id.endsWith('_baseline'))?.value
    const dashboard: DashboardDTO = {
      workspace: { id: scope.workspaceId, name: northstarCompany.name, organizationId: scope.organizationId },
      metrics: [
        { key: 'revenue', label: 'Revenue', value: money(revenueCurrent), change: change(revenueCurrent, revenueBaseline), trend: revenueCurrent > revenueBaseline ? 'up' : revenueCurrent < revenueBaseline ? 'down' : 'flat' },
        { key: 'cash_position', label: 'Cash Position', value: money(cashCurrent), change: change(cashCurrent, cashBaseline), trend: cashCurrent > cashBaseline ? 'up' : cashCurrent < cashBaseline ? 'down' : 'flat' },
        { key: 'pipeline', label: 'Pipeline', value: money(pipelineCurrent), change: change(pipelineCurrent, pipelineBaseline), trend: pipelineCurrent > pipelineBaseline ? 'up' : pipelineCurrent < pipelineBaseline ? 'down' : 'flat' },
        { key: 'overdue_invoices', label: 'Overdue Invoices', value: money(overdueCurrent), change: change(overdueCurrent, overdueBaseline), trend: overdueCurrent !== undefined && overdueBaseline !== undefined && overdueCurrent > overdueBaseline ? 'down' : 'flat' },
      ],
      attention: [],
    }
    dashboard.attention = issues.map((item) => { const opportunity = opportunities.find((candidate) => candidate.issueId === item.id); const title = item.id === 'issue_sales_conversion_decline' ? 'Proposal turnaround is slowing sales' : item.title; return { issueId: item.id, title, detail: `${item.description} Estimated annual impact: $${Math.round(item.impact.estimatedAnnualValue).toLocaleString()}.`, severity: item.severity, deepLink: item.id === 'issue_sales_conversion_decline' ? '/app/opportunities/root-cause' : '/app/opportunities', priority: (opportunity?.priorityScore ?? 0) * (scenario === 'conflicting_evidence' && item.id === 'issue_sales_conversion_decline' ? .72 : 1) + (item.status === 'open' ? 10 : 0) } }).sort((left, right) => right.priority - left.priority).slice(0, 3).map(({ priority: _priority, ...item }) => item)
    const simulation = state.scenario === 'failed_action'
      ? { ...state.simulation, status: 'failed' as const, actionStatus: 'failed' as const, failureReason: 'The synthetic action was rejected by the target workflow. No records were changed.' }
      : state.scenario === 'no_roi'
        ? { ...state.simulation, status: 'completed' as const, actionStatus: 'completed' as const, elapsedDays: state.simulation.targetDays, outcome: undefined, roiRecord: undefined }
        : state.simulation
    const agents = this.agentViews(scope, opportunities, simulation, state)
    const sourceName = (source: string) => ({ hubspot: 'HubSpot', outlook: 'Outlook', microsoft_calendar: 'Calendar', google_calendar: 'Calendar', google_drive: 'Google Drive', onedrive: 'OneDrive', quickbooks: 'QuickBooks', gmail: 'Gmail', slack: 'Slack', shopify: 'Shopify', csv_excel: 'CSV / Excel' } as Record<string, string>)[source] ?? source
    const sourcesFor = (ids: string[]) => [...new Set(evidenceRows.filter((item) => ids.includes(item.id)).map((item) => sourceName(item.sourceSystem)))]
    const evidenceForSignal = (id: string) => evidenceRows.filter((item) => item.signalId === id).map((item) => item.id)
    const topIssue = issues.find((item) => item.id === 'issue_sales_conversion_decline')!
    const pendingApprovals = state.approvals.filter((item) => item.status === 'pending')
    const briefItems: SyntheticBriefItem[] = [
      { id: 'brief_attention_sales', section: 'Needs Attention', title: 'Proposal turnaround is slowing sales', detail: 'Conversion fell to 23% while response time reached 17 hours. Estimated annual opportunity: $82K.', priority: 100, tone: 'red', deepLink: '/app/opportunities/root-cause', evidenceIds: topIssue.evidenceIds, sourceLabels: sourcesFor(topIssue.evidenceIds), status: 'open' },
      { id: 'brief_attention_approval', section: 'Needs Attention', title: pendingApprovals.length ? 'Proposal Intelligence needs approval' : 'No approval is currently blocking work', detail: pendingApprovals.length ? 'A draft-only action is waiting for an owner review before deployment.' : 'All synthetic actions are either completed or not yet requested.', priority: pendingApprovals.length ? 96 : 35, tone: pendingApprovals.length ? 'yellow' : 'green', deepLink: '/app/opportunities/deploy', evidenceIds: [], sourceLabels: [], status: pendingApprovals.length ? 'pending' : 'completed' },
      ...signals.slice(0, 3).map((signal, index) => ({ id: `brief_signal_${signal.id}`, section: 'Changes Since Last Brief' as const, title: signal.name, detail: signal.description, priority: 84 - index * 6, tone: signal.severity === 'high' ? 'yellow' as const : 'blue' as const, deepLink: '/app/insights', evidenceIds: evidenceForSignal(signal.id), sourceLabels: sourcesFor(evidenceForSignal(signal.id)), status: 'open' as const })),
      ...state.actions.filter((item) => item.status === 'completed').slice(-3).reverse().map((action, index) => ({ id: `brief_completed_${action.id}`, section: 'Completed by Gilar' as const, title: index === 0 && simulation.outcome ? 'Proposal Intelligence completed its measurement window' : 'Approved proposal draft completed', detail: simulation.outcome && index === 0 ? `${simulation.outcome.timeSavedHours ?? 0} hours saved and $${Math.round(simulation.outcome.costSaved ?? 0).toLocaleString()} labor savings were measured.` : 'The action stayed within the approval boundary and produced a draft for review.', priority: 76 - index * 5, tone: 'green' as const, deepLink: '/app/agents/proposal', evidenceIds: [], sourceLabels: [], status: 'completed' as const })),
      ...opportunities.slice(0, 3).map((opportunity, index) => ({ id: `brief_opportunity_${opportunity.id}`, section: 'Opportunities' as const, title: opportunity.title, detail: `$${Math.round(opportunity.estimatedAnnualValue).toLocaleString()} estimated annual value · ${Math.round(opportunity.confidence * 100)}% confidence · ${opportunity.evidenceIds.length} linked evidence records.`, priority: 72 - index * 4, tone: index === 0 ? 'blue' as const : 'gray' as const, deepLink: opportunity.id === 'opportunity_proposal_intelligence' ? '/app/opportunities/root-cause' : '/app/opportunities', evidenceIds: opportunity.evidenceIds, sourceLabels: sourcesFor(opportunity.evidenceIds), status: 'open' as const })),
      { id: 'brief_watchlist_inventory', section: 'Watchlist', title: 'Inventory cover is approaching the replenishment threshold', detail: 'Beta Industrial Gloves have 12 days of projected cover while demand is up 26%.', priority: 62, tone: 'yellow', deepLink: '/app/opportunities', evidenceIds: ['evidence_shopify_demand', 'evidence_inventory_cover'], sourceLabels: sourcesFor(['evidence_shopify_demand', 'evidence_inventory_cover']), status: 'watching' },
      { id: 'brief_watchlist_tools', section: 'Watchlist', title: 'Three software tools remain below 35% utilization', detail: 'Keep the renewal review on the watchlist until an owner confirms the replacement plan.', priority: 48, tone: 'gray', deepLink: '/app/opportunities', evidenceIds: ['evidence_tool_utilization', 'evidence_software_spend'], sourceLabels: sourcesFor(['evidence_tool_utilization', 'evidence_software_spend']), status: 'watching' },
    ]
    const conflicts: SyntheticConflict[] = scenario === 'conflicting_evidence' ? [{ id: 'conflict_growth_vs_revenue', title: 'Evidence is mixed', detail: 'CRM activity increased while revenue declined in the same comparison period. Gilar is lowering confidence rather than forcing a single explanation.', sourceLabels: ['HubSpot', 'QuickBooks'], confidence: .58, evidenceIds: ['evidence_sales_conversion', 'evidence_qb_sku_sales'] }] : []
    const edgeStates: SyntheticEdgeState[] = scenario === 'low_confidence'
      ? [{ key: 'low-confidence', label: 'Low-confidence diagnosis', description: 'Gilar detected the business problem, but current evidence is insufficient to establish one root cause.', tone: 'warning', actionLabel: 'Connect operational evidence', actionLink: '/app/settings' }]
      : scenario === 'partial_coverage'
        ? [{ key: 'partial-coverage', label: 'Partial coverage', description: 'Some source systems are unavailable, so this diagnosis should be treated as directional.', tone: 'warning', actionLabel: 'Review connected tools', actionLink: '/app/settings' }]
        : scenario === 'failed_action'
          ? [{ key: 'action-failed', label: 'Action failed safely', description: 'The action was rejected before any business record changed. No records were changed. Review the reason and retry only after approval.', tone: 'error', actionLabel: 'Review action', actionLink: '/app/opportunities/deploy' }]
          : scenario === 'no_roi'
            ? [{ key: 'roi-unavailable', label: 'No measurable outcome yet', description: 'The measurement window completed, but the available data could not attribute a reliable business result.', tone: 'warning', actionLabel: 'Review measurement method', actionLink: '/app/insights' }]
            : conflicts.length
              ? [{ key: 'conflicting-evidence', label: 'Evidence is mixed', description: conflicts[0].detail, tone: 'warning', actionLabel: 'Review evidence', actionLink: '/app/opportunities/root-cause' }]
              : []
    const brief = {
      generatedAt: AS_OF,
      items: briefItems,
      whatChanged: briefItems.filter((item) => item.section === 'Changes Since Last Brief').map((item) => item.detail),
      whatMatters: briefItems.filter((item) => item.section === 'Needs Attention').map((item) => `${item.title}: ${item.detail}`),
      newSignals: signals.map((signal) => signal.description),
      completedActions: briefItems.filter((item) => item.section === 'Completed by Gilar').map((item) => item.detail),
      emergingRisks: briefItems.filter((item) => item.section === 'Watchlist').map((item) => item.detail),
      opportunities: briefItems.filter((item) => item.section === 'Opportunities').map((item) => item.detail),
      agentResults: agents.flatMap((agent) => agent.results.slice(0, 1)),
    }
    const aliasMap: Record<string, string> = { conversion_decline: 'sales_conversion_rate', response_time_increase: 'lead_response_time', overdue_receivables: 'overdue_receivables', invoice_payment_delay: 'invoice_payment_delay', administrative_workload: 'administrative_workload', software_spend_anomaly: 'software_spend', inventory_shortage: 'inventory_days_remaining', customer_inactivity: 'inactive_high_value_accounts', revenue: 'revenue', cash_position: 'cash_position', pipeline_value: 'pipeline_value' }
    const sourceSystems: Record<string, string[]> = { conversion_decline: ['HubSpot'], response_time_increase: ['Outlook'], overdue_receivables: ['QuickBooks'], invoice_payment_delay: ['QuickBooks'], administrative_workload: ['CSV / Excel'], software_spend_anomaly: ['QuickBooks'], inventory_shortage: ['Shopify'], customer_inactivity: ['HubSpot'], revenue: ['Shopify'], cash_position: ['QuickBooks'], pipeline_value: ['HubSpot'] }
    const series: Record<string, MetricSeriesPoint[]> = { revenue: monthlySeries(orders, BASELINE_START, 6, ['orderedAt'], ['total']), cash_position: monthlySeries(payments, BASELINE_START, 6, ['paidAt'], ['amount']), pipeline_value: monthlySeries(deals, BASELINE_START, 6, ['openedAt'], ['amount'], (record) => ['qualified', 'proposal'].includes(String(recordField(record, ['stage'])))) }
    const metricRegistry = buildMetricRegistry({ metrics, observations, asOf: AS_OF, keyAliases: aliasMap, sourceSystems, series, metadata: { revenue: { calculationMethod: 'Sum of normalized order totals by month.', evidenceState: 'calculated', period: 'Trailing 3 months' }, cash_position: { calculationMethod: 'Sum of normalized payments in the comparison period.', evidenceState: 'calculated', period: 'Trailing 3 months' }, pipeline_value: { calculationMethod: 'Sum of qualified and proposal-stage deals opened in the comparison period.', evidenceState: 'calculated', period: 'Trailing 3 months' } } })
    const businessProfile: BusinessProfileDTO = { companyName: northstarCompany.name, industry: northstarCompany.industry, subIndustry: 'Industrial distribution', businessModel: 'B2B', employeeCount: northstarCompany.employeeCount, annualRevenueRange: northstarCompany.annualRevenueRange, geography: 'Synthetic North America workspace', customerType: 'B2B', salesCycle: 'Proposal-driven commercial sales', primaryProductsOrServices: ['Industrial supplies', 'Safety products', 'Packaging'], majorOperatingFunctions: ['Sales', 'Distribution', 'Finance', 'Customer success'], goals: ['Improve sales response speed', 'Protect cash collection', 'Reduce operating friction'], currentChallenges: issues.slice(0, 3).map((item) => item.title), seasonality: 'Not established from current history', strategicPriorities: opportunities.slice(0, 3).map((item) => item.title), source: 'synthetic_fixture', updatedAt: AS_OF }
    const advisoryContext = createAdvisoryContext({ workspace: { name: northstarCompany.name, industry: northstarCompany.industry }, businessProfile, metrics: metricRegistry.metrics, signals, evidence: evidenceRows, issues, rootCauses, opportunities, recommendations })
    const advisory = createAdvisoryOutput(advisoryContext)
    return { metrics, observations, signals, evidence: evidenceRows, issues, rootCauses, opportunities, recommendations, health, dashboard, brief, agents, scenario, briefItems, conflicts, edgeStates, metricRegistry, businessProfile, advisoryContext, advisory }
  }

  private agentViews(scope: TenantScope, opportunities: Opportunity[], simulation: SyntheticSimulationSnapshot, state: TenantState): SyntheticAgentView[] {
    const completedActions = state.actions.filter((item) => item.status === 'completed')
    const pendingApprovals = state.approvals.filter((item) => item.status === 'pending')
    const proposalRuns = state.agentRuns.filter((item) => item.agentId === 'agent_proposal_intelligence')
    const sourceLabel = (source: string) => ({ hubspot: 'HubSpot', outlook: 'Outlook', google_drive: 'Google Drive', onedrive: 'OneDrive', quickbooks: 'QuickBooks', slack: 'Slack', csv_excel: 'CSV / Excel' } as Record<string, string>)[source] ?? source
    const timeline: SyntheticActivityEvent[] = [
      { id: 'timeline_opportunity_identified', occurredAt: '2026-10-21T09:14:00.000Z', title: 'Opportunity identified', detail: 'Proposal turnaround became the highest-priority growth lever.', recordType: 'Opportunity', recordId: 'opportunity_proposal_intelligence', status: 'observed' },
      { id: 'timeline_solution_proposed', occurredAt: '2026-10-21T09:17:00.000Z', title: 'Draft solution proposed', detail: 'Proposal Intelligence was prepared in draft-only mode.', recordType: 'Recommendation', recordId: 'recommendation_opportunity_proposal_intelligence', status: 'proposed' },
      ...(simulation.status === 'approved' || simulation.status === 'running' || simulation.status === 'completed' ? [{ id: 'timeline_approved', occurredAt: '2026-10-21T10:02:00.000Z', title: 'Milad approved deployment', detail: 'Human approval was recorded before activation.', recordType: 'Approval' as const, recordId: simulation.actionId ?? 'approval_proposal_pending', status: 'approved' as const }] : []),
      ...(simulation.status === 'running' || simulation.status === 'completed' ? [{ id: 'timeline_activated', occurredAt: '2026-10-21T10:04:00.000Z', title: 'Proposal workflow activated', detail: 'The agent began the controlled draft-only measurement window.', recordType: 'Action' as const, recordId: simulation.actionId ?? 'action_proposal_pending', status: 'running' as const }] : []),
      ...(simulation.status === 'completed' && simulation.outcome ? [{ id: 'timeline_outcome', occurredAt: simulation.outcome.measuredAt, title: 'Measured outcome recorded', detail: `${simulation.outcome.timeSavedHours ?? 0} hours saved; ROI remains separated into measured and estimated components.`, recordType: 'Outcome' as const, recordId: simulation.outcome.id, status: 'completed' as const }] : []),
      ...(simulation.status === 'failed' ? [{ id: 'timeline_failed', occurredAt: AS_OF, title: 'Action rejected safely', detail: simulation.failureReason ?? 'No records were changed.', recordType: 'Action' as const, recordId: simulation.actionId ?? 'action_proposal_pending', status: 'failed' as const }] : []),
    ]
    const makeAgent = (id: string, name: string, description: string, status: Agent['status'], permissions: string[], currentTask: string, businessImpact: string, runs: SyntheticAgentRunView[], actions: SyntheticAgentActionView[], stats: SyntheticAgentStats, activity: string[], tasks: string[], results: string[]): SyntheticAgentView => ({ agent: { ...baseRecord(scope, id), name, description, status, requiredPermissions: permissions.map((permission) => permission.toLowerCase() as Agent['requiredPermissions'][number]), configuration: { approvalRequired: true, synthetic: true } }, activity, tasks, results, businessImpact, permissions, currentTask, stats, runs, actions, approvals: id === 'agent_proposal_intelligence' ? state.approvals : [], timeline: id === 'agent_proposal_intelligence' ? timeline : [] })
    const proposalActions = state.actions.filter((item) => item.recommendationId === 'recommendation_opportunity_proposal_intelligence').map((item) => ({ id: item.id, title: item.operation === 'deploy_synthetic_proposal_intelligence' ? 'Proposal Intelligence deployment' : 'Draft proposal for review', status: item.status, requestedAt: item.requestedAt, approvedAt: item.approvedAt, completedAt: item.completedAt, approvalRequired: true }))
    const proposalStats: SyntheticAgentStats = { assisted: proposalRuns.length, completedRuns: proposalRuns.filter((item) => item.status === 'completed').length, failedRuns: proposalRuns.filter((item) => item.status === 'failed').length, pendingApprovals: pendingApprovals.length, completedActions: completedActions.length + (simulation.status === 'completed' ? 1 : 0), hoursSaved: simulation.outcome?.timeSavedHours ?? 116, measuredImpact: simulation.outcome?.annualizedImpact ?? 0, estimatedImpact: opportunities[0]?.estimatedAnnualValue ?? 0, successRate: proposalRuns.length ? Math.round((proposalRuns.filter((item) => item.status === 'completed').length / proposalRuns.length) * 100) : 0, directionalROI: simulation.roiRecord ? simulation.roiRecord.annualizedImpact / Math.max(1, simulation.roiRecord.implementationCost ?? 1) : opportunities[0]?.roi }
    return [
      makeAgent('agent_proposal_intelligence', 'Proposal Intelligence', 'Searches approved proposal context and prepares a first draft for review.', simulation.status === 'failed' ? 'paused' : simulation.status === 'completed' ? 'active' : 'recommended', ['Observe', 'Recommend', 'Draft only'], simulation.status === 'completed' ? 'Monitor the measured result and source-linked ROI.' : pendingApprovals.length ? 'Waiting for owner approval before deployment.' : 'Ready to prepare the next approved draft.', '$82K estimated annual opportunity', proposalRuns.slice(-5).reverse().map((run, index) => ({ id: run.id, status: run.status, startedAt: run.startedAt, completedAt: run.completedAt, title: run.status === 'failed' ? 'Draft held for review' : `Proposal assisted ${proposalRuns.length - index}`, detail: run.errorMessage ?? 'Source-linked draft prepared for employee review.', recordType: 'AgentRun', recordId: run.id })), proposalActions, proposalStats, ['Indexed proposal records from HubSpot and Drive.', `Matched ${matchCrossSourceEntities(state.records).size} shared entities across sources.`, `${proposalRuns.length} proposal runs are auditable in this workspace.`], ['Prepare the next owner-approved draft', 'Flag stale pricing references'], simulation.outcome ? [`${simulation.outcome.timeSavedHours ?? 0} hours saved in the controlled window.`, `$${Math.round(simulation.outcome.costSaved ?? 0).toLocaleString()} labor savings measured.`] : ['Found 187 fragmented proposal files and 17-hour lead response time.']),
      makeAgent('agent_inbox_operations', 'Inbox Operations', 'Routes high-intent customer and supplier messages to the right owner.', 'recommended', ['Observe', 'Recommend'], 'Review the next owner-approved reminder queue.', '$48K receivables exposure', [], [], { assisted: 0, completedRuns: 0, failedRuns: 0, pendingApprovals: 0, completedActions: 0, hoursSaved: 0, measuredImpact: 0, estimatedImpact: 48000, successRate: 0 }, ['Clustered communication events from Outlook and Gmail.'], ['Draft owner-approved reminder queue', 'Escalate missing PO fields'], ['42% overdue reminder coverage needs an owner.']),
      makeAgent('agent_cost_intelligence', 'Cost Intelligence', 'Finds duplicate spend and flags under-used subscriptions.', 'recommended', ['Observe', 'Recommend'], 'Prepare the next renewal review.', '$19.8K estimated savings', [], [], { assisted: 0, completedRuns: 0, failedRuns: 0, pendingApprovals: 0, completedActions: 0, hoursSaved: 0, measuredImpact: 0, estimatedImpact: 19800, successRate: 0 }, ['Compared QuickBooks recurring expenses with activity records.'], ['Prepare renewal review', 'Identify seat reductions'], ['Three overlapping tools remain below 35% utilization.']),
      makeAgent('agent_growth', 'Growth', 'Connects response speed, pipeline, and conversion signals.', 'active', ['Observe', 'Recommend'], 'Monitor conversion and response-time signals.', '$38K estimated upside', [], [], { assisted: 0, completedRuns: 0, failedRuns: 0, pendingApprovals: 0, completedActions: 0, hoursSaved: 0, measuredImpact: 0, estimatedImpact: 38000, successRate: 0 }, ['Tracked HubSpot deal-stage movement and response signals.'], ['Prioritize high-intent leads', 'Review second-touch coverage'], ['Conversion decline is strongest in the last 90 days.']),
      makeAgent('agent_document_automation', 'Document Automation', 'Extracts PO fields and routes exceptions before manual re-keying.', 'recommended', ['Observe', 'Recommend'], 'Wait for an approved document workflow.', '$28K estimated savings', [], [], { assisted: 0, completedRuns: 0, failedRuns: 0, pendingApprovals: 0, completedActions: 0, hoursSaved: 0, measuredImpact: 0, estimatedImpact: 28000, successRate: 0 }, ['Read synthetic PO records from CSV / Excel.'], ['Extract supplier PO fields', 'Match vendor and shipment'], ['46 fields per week are manually entered.']),
      makeAgent('agent_opportunity_finder', 'Opportunity Finder', 'Ranks cross-source signals by impact, confidence, urgency, and effort.', 'active', ['Observe', 'Recommend'], 'Keep the opportunity map ranked by evidence quality.', `$${Math.round(opportunities.reduce((sum, item) => sum + item.estimatedAnnualValue, 0) / 1000)}K identified`, [], [], { assisted: opportunities.length, completedRuns: 0, failedRuns: 0, pendingApprovals: 0, completedActions: 0, hoursSaved: 0, measuredImpact: 0, estimatedImpact: opportunities.reduce((sum, item) => sum + item.estimatedAnnualValue, 0), successRate: 100, directionalROI: undefined }, ['Scanned 12 synthetic sources.', `Matched ${matchCrossSourceEntities(state.records).size} shared entities.`], ['Review top ranked opportunities', 'Open customer-facing evidence'], ['Ranked proposal turnaround as the highest-confidence growth lever.']),
    ]
  }

  overview(scope: TenantScope): SyntheticOverview {
    const state = this.tenant(scope)
    const analysis = this.analysis(scope)
    const providerRecords = recordsByProvider(state.raw)
    const sourceDisplayNames: Record<string, string> = { quickbooks: 'QuickBooks', outlook: 'Outlook', gmail: 'Gmail', microsoft_calendar: 'Microsoft Calendar', google_calendar: 'Google Calendar', google_drive: 'Google Drive', onedrive: 'OneDrive', slack: 'Slack', hubspot: 'HubSpot', salesforce: 'Salesforce', shopify: 'Shopify', csv_excel: 'CSV / Excel' }
    const sources: SyntheticSourceSummary[] = syntheticProviders.map((provider) => ({ provider, displayName: sourceDisplayNames[provider] ?? provider.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), status: state.scenario === 'partial_coverage' && provider === 'microsoft_calendar' ? 'needs_attention' : state.scenario === 'partial_coverage' && provider === 'google_drive' ? 'disconnected' : 'connected', mode: 'synthetic', permission: provider === 'hubspot' || provider === 'gmail' || provider === 'outlook' ? 'recommend' : 'observe', recordCount: state.scenario === 'partial_coverage' && provider === 'google_drive' ? 0 : providerRecords[provider].length, lastSyncedAt: AS_OF, label: 'SYNTHETIC' }))
    const byEntityType = state.records.reduce<Record<string, number>>((counts, record) => { counts[record.provenance.sourceEntityType] = (counts[record.provenance.sourceEntityType] ?? 0) + 1; return counts }, {})
    const bySource = state.raw.reduce<Record<string, number>>((counts, record) => { counts[record.provider] = (counts[record.provider] ?? 0) + 1; return counts }, {})
    const groups = matchCrossSourceEntities(state.records)
    const evidenceForRecord = new Map<string, { signalIds: string[]; opportunityId?: string }>()
    analysis.evidence.forEach((item) => (item.sourceRecordIds ?? [item.sourceRecordId]).filter(Boolean).forEach((recordId) => evidenceForRecord.set(recordId!, { signalIds: item.signalId ? [item.signalId] : [], opportunityId: analysis.opportunities.find((opportunity) => opportunity.evidenceIds.includes(item.id))?.id })))
    const explorer = state.records.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 240).map((record) => ({ id: record.id, source: record.provenance.provider, entityType: record.provenance.sourceEntityType, normalizedEntity: record.canonicalEntityId ?? record.id, canonicalEntityId: record.canonicalEntityId, timestamp: record.updatedAt, relatedSignalIds: evidenceForRecord.get(record.id)?.signalIds ?? [], relatedOpportunityId: evidenceForRecord.get(record.id)?.opportunityId, preview: Object.entries(record).filter(([key]) => !['id', 'organizationId', 'workspaceId', 'createdAt', 'updatedAt', 'provenance', 'metadata'].includes(key)).slice(0, 5).reduce<Record<string, string | number>>((result, [key, value]) => { if (typeof value === 'string' || typeof value === 'number') result[key] = value; return result }, {}) }))
    const simulation = state.scenario === 'failed_action'
      ? { ...state.simulation, status: 'failed' as const, actionStatus: 'failed' as const, failureReason: 'The synthetic action was rejected by the target workflow. No records were changed.' }
      : state.scenario === 'no_roi'
        ? { ...state.simulation, status: 'completed' as const, actionStatus: 'completed' as const, elapsedDays: state.simulation.targetDays, outcome: undefined, roiRecord: undefined }
        : state.simulation
    return { mode: 'synthetic', company: northstarCompany, sources, records: { total: state.records.length, bySource, byEntityType, crossSourceEntityCount: [...groups.values()].filter((group) => new Set(group.map((record) => record.provenance.provider)).size > 1).length }, ...analysis, roiRecords: simulation.roiRecord ? [simulation.roiRecord] : [], simulation: structuredClone(simulation), explorer }
  }

  propose(scope: TenantScope, action: Action): SyntheticSimulationSnapshot { const state = this.tenant(scope); if (!state.actions.some((item) => item.id === action.id)) state.actions.push(action); if (!state.approvals.some((item) => item.actionId === action.id)) state.approvals.push({ ...baseRecord(scope, `approval_${action.id}`), actionId: action.id, requestedByUserId: action.proposedByUserId, status: 'pending', requestedAt: action.requestedAt }); state.simulation = { ...state.simulation, status: 'proposed', actionStatus: action.status, actionId: action.id, lifecycle: ['proposed', 'awaiting_approval'] }; return structuredClone(state.simulation) }
  approve(scope: TenantScope, action: Action): SyntheticSimulationSnapshot { const state = this.tenant(scope); state.actions = state.actions.map((item) => item.id === action.id ? action : item); state.approvals = state.approvals.map((item) => item.actionId === action.id ? { ...item, status: 'approved' as const, reviewedByUserId: action.approvedByUserId, reviewedAt: action.approvedAt } : item); state.simulation = { ...state.simulation, status: 'approved', actionStatus: action.status, actionId: action.id, lifecycle: ['proposed', 'awaiting_approval', 'approved'] }; return structuredClone(state.simulation) }
  deploy(scope: TenantScope, action: Action): SyntheticSimulationSnapshot { const state = this.tenant(scope); state.actions = state.actions.map((item) => item.id === action.id ? action : item); if (state.scenario === 'failed_action') { state.simulation = { ...state.simulation, status: 'failed', actionStatus: 'failed', actionId: action.id, failureReason: 'The synthetic action was rejected by the target workflow. No records were changed.' }; return structuredClone(state.simulation) } state.simulation = { ...state.simulation, status: 'running', actionStatus: 'running', actionId: action.id, interventionAt: AS_OF, lifecycle: ['proposed', 'awaiting_approval', 'approved', 'queued', 'running'] }; return structuredClone(state.simulation) }

  advance(scope: TenantScope, days: number): SyntheticSimulationSnapshot {
    if (!Number.isFinite(days) || days <= 0 || days > 365) throw new Error('Simulation days must be between 1 and 365.')
    const state = this.tenant(scope)
    if (state.simulation.status === 'baseline') throw new Error('Approve and deploy the synthetic recommendation before advancing time.')
    if (state.scenario === 'failed_action') throw new Error('The synthetic action failed before measurement began.')
    const elapsedDays = Math.min(state.simulation.targetDays, state.simulation.elapsedDays + Math.floor(days))
    if (elapsedDays < state.simulation.targetDays) { state.simulation = { ...state.simulation, elapsedDays }; return structuredClone(state.simulation) }
    const measuredAt = new Date(new Date(AS_OF).getTime() + state.simulation.targetDays * 86400000).toISOString()
    const after = { proposalMinutes: 58, leadResponseHours: 4.2, conversionRate: .27 }
    if (state.scenario === 'no_roi') { state.simulation = { ...state.simulation, status: 'completed', actionStatus: 'completed', elapsedDays, outcome: undefined, roiRecord: undefined, lifecycle: ['proposed', 'awaiting_approval', 'approved', 'queued', 'running', 'completed'] }; return structuredClone(state.simulation) }
    const outcome: Outcome = { ...baseRecord(scope, 'outcome_proposal_intelligence', measuredAt), actionId: state.simulation.actionId, recommendationId: 'recommendation_opportunity_proposal_intelligence', metricId: 'metric_syn_response', baselineValue: state.simulation.before.proposalMinutes, postInterventionValue: after.proposalMinutes, measuredAt, measurementStart: AS_OF, measurementEnd: measuredAt, timeSavedHours: 116, costSaved: 4870, revenueGained: 37000, annualizedImpact: 41870, confidence: .87 }
    const roiRecord = calculateSyntheticROI(outcome, 8000)
    state.actions = state.actions.map((item) => item.id === state.simulation.actionId ? { ...item, status: 'completed' as const, completedAt: measuredAt, outcomeId: outcome.id } : item)
    state.simulation = { ...state.simulation, status: 'completed', actionStatus: 'completed', elapsedDays, after, outcome, roiRecord, lifecycle: ['proposed', 'awaiting_approval', 'approved', 'queued', 'running', 'completed'] }
    return structuredClone(state.simulation)
  }
}

