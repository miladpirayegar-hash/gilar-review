import type { BusinessMetric, Evidence, Issue, RootCause, Signal, TenantScope } from '../../shared/domain/models'

export interface SignalInput {
  metric: BusinessMetric
  currentValue: number
  baselineValue: number
  observedAt: string
  observationIds: string[]
  sourceId?: string
}

export interface SignalRule {
  key: string
  name: string
  description: (input: SignalInput, percentageChange: number) => string
  thresholdPercent: number
  direction: 'up' | 'down' | 'either'
  severity: (percentageChange: number) => Signal['severity']
}

const signalRules: SignalRule[] = [
  { key: 'revenue_decline', name: 'Revenue decline', thresholdPercent: 5, direction: 'down', description: (_input, change) => `Revenue is ${Math.abs(change).toFixed(1)}% below the comparison period.`, severity: (change) => change <= -15 ? 'high' : 'medium' },
  { key: 'expense_increase', name: 'Expense increase', thresholdPercent: 10, direction: 'up', description: (_input, change) => `Expenses increased ${change.toFixed(1)}% against the comparison period.`, severity: (change) => change >= 25 ? 'high' : 'medium' },
  { key: 'overdue_invoice_increase', name: 'Overdue invoice exposure', thresholdPercent: 15, direction: 'up', description: (_input, change) => `Overdue invoice exposure increased ${change.toFixed(1)}%.`, severity: (change) => change >= 40 ? 'high' : 'medium' },
  { key: 'conversion_decline', name: 'Sales conversion decline', thresholdPercent: 8, direction: 'down', description: (_input, change) => `Sales conversion is down ${Math.abs(change).toFixed(1)}% against the comparison period.`, severity: (change) => change <= -12 ? 'high' : 'medium' },
  { key: 'response_time_increase', name: 'Slower response time', thresholdPercent: 15, direction: 'up', description: (_input, change) => `Median response time increased ${change.toFixed(1)}%.`, severity: (change) => change >= 75 ? 'high' : 'medium' },
  { key: 'inventory_shortage', name: 'Inventory shortage', thresholdPercent: 20, direction: 'down', description: (input) => `${input.metric.name} is projected to last only ${input.currentValue} days.`, severity: () => 'high' },
  { key: 'software_spend_anomaly', name: 'Software spend anomaly', thresholdPercent: 15, direction: 'up', description: (_input, change) => `Software spend is ${change.toFixed(1)}% above the comparison period.`, severity: (change) => change >= 30 ? 'high' : 'medium' },
  { key: 'customer_inactivity', name: 'Customer inactivity', thresholdPercent: 15, direction: 'up', description: (_input, change) => `Inactive customer count increased ${change.toFixed(1)}%.`, severity: (change) => change >= 30 ? 'high' : 'medium' },
  { key: 'administrative_workload', name: 'Growing administrative workload', thresholdPercent: 15, direction: 'up', description: (_input, change) => `Administrative workload increased ${change.toFixed(1)}%.`, severity: (change) => change >= 30 ? 'high' : 'medium' },
  { key: 'overdue_receivables', name: 'Receivables deterioration', thresholdPercent: 15, direction: 'up', description: (_input, change) => `Overdue receivables increased ${change.toFixed(1)}% against the comparison period.`, severity: (change) => change >= 40 ? 'high' : 'medium' },
  { key: 'expense_acceleration', name: 'Expense growth is accelerating', thresholdPercent: 10, direction: 'up', description: (_input, change) => `Expenses increased ${change.toFixed(1)}% against the comparison period.`, severity: (change) => change >= 25 ? 'high' : 'medium' },
  { key: 'customer_concentration', name: 'Customer concentration risk', thresholdPercent: 15, direction: 'up', description: (input) => `The largest customer represents ${(input.currentValue * 100).toFixed(1)}% of measured revenue.`, severity: (change) => change >= 35 ? 'high' : 'medium' },
  { key: 'vendor_concentration', name: 'Vendor concentration risk', thresholdPercent: 15, direction: 'up', description: (input) => `The largest vendor represents ${(input.currentValue * 100).toFixed(1)}% of measured expenses.`, severity: (change) => change >= 35 ? 'high' : 'medium' },
  { key: 'margin_compression', name: 'Margin compression', thresholdPercent: 5, direction: 'down', description: (_input, change) => `Gross margin declined ${Math.abs(change).toFixed(1)}% against the comparison period.`, severity: (change) => change <= -15 ? 'high' : 'medium' },
  { key: 'invoice_payment_delay', name: 'Slower invoice payment', thresholdPercent: 10, direction: 'up', description: (_input, change) => `Average invoice payment delay increased ${change.toFixed(1)}%.`, severity: (change) => change >= 30 ? 'high' : 'medium' },
]

const now = () => new Date().toISOString()

export function detectSignals(scope: TenantScope, inputs: SignalInput[], detectedAt = now()): Signal[] {
  const signals: Signal[] = []
  inputs.forEach((input) => {
    const absoluteChange = input.currentValue - input.baselineValue
    const percentageChange = input.baselineValue === 0 ? 0 : (absoluteChange / Math.abs(input.baselineValue)) * 100
    const rule = signalRules.find((candidate) => candidate.key === input.metric.key)
    if (!rule) return
    const matchesDirection = rule.direction === 'either' || (rule.direction === 'up' && percentageChange > 0) || (rule.direction === 'down' && percentageChange < 0)
    if (!matchesDirection || Math.abs(percentageChange) < rule.thresholdPercent) return
    signals.push({
      id: `signal_${rule.key}`,
      organizationId: scope.organizationId,
      workspaceId: scope.workspaceId,
      createdAt: detectedAt,
      updatedAt: detectedAt,
      metricId: input.metric.id,
      sourceId: input.sourceId,
      name: rule.name,
      description: rule.description(input, percentageChange),
      currentValue: input.currentValue,
      baselineValue: input.baselineValue,
      absoluteChange,
      percentageChange,
      direction: percentageChange > 0 ? 'up' : percentageChange < 0 ? 'down' : 'flat',
      severity: rule.severity(percentageChange),
      detectedAt,
      confidence: Math.min(99, Math.max(70, Math.round(82 + Math.abs(percentageChange) / 8))),
      observationIds: input.observationIds,
      status: 'open',
    })
  })
  return signals
}

export interface DiagnosisResult {
  issue: Issue
  evidence: Evidence[]
  rootCauses: RootCause[]
}

export function buildSalesConversionDiagnosis(scope: TenantScope, signal: Signal, detectedAt = now()): DiagnosisResult {
  const evidence: Evidence[] = [
    { id: 'evidence_response_time', organizationId: scope.organizationId, workspaceId: scope.workspaceId, createdAt: detectedAt, updatedAt: detectedAt, sourceSystem: 'gmail', sourceRecordId: 'gmail_thread_summary', signalId: signal.id, observedValue: 4.3, comparisonValue: 2.1, observedAt: detectedAt, description: 'Median proposal response time increased from 2.1 to 4.3 days.', strength: 0.94, relevance: 0.97 },
    { id: 'evidence_manual_proposals', organizationId: scope.organizationId, workspaceId: scope.workspaceId, createdAt: detectedAt, updatedAt: detectedAt, sourceSystem: 'google_drive', sourceRecordId: 'proposal_library', signalId: signal.id, observedValue: 12, comparisonValue: 8, observedAt: detectedAt, description: 'The team spends approximately 12 hours per week gathering context for proposals.', strength: 0.88, relevance: 0.93 },
    { id: 'evidence_follow_up_coverage', organizationId: scope.organizationId, workspaceId: scope.workspaceId, createdAt: detectedAt, updatedAt: detectedAt, sourceSystem: 'gmail', sourceRecordId: 'follow_up_activity', signalId: signal.id, observedValue: 27, comparisonValue: 64, observedAt: detectedAt, description: 'Only 3 of 11 high-intent leads received a second touch.', strength: 0.81, relevance: 0.86 },
  ]
  const rootCauses: RootCause[] = [
    { id: 'root_cause_response_time', organizationId: scope.organizationId, workspaceId: scope.workspaceId, createdAt: detectedAt, updatedAt: detectedAt, issueId: 'issue_sales_conversion_decline', title: 'Proposal response time increased', explanation: 'Median response time increased from 2.1 to 4.3 days.', contributingFactorIds: ['factor_manual_proposals'], evidenceIds: ['evidence_response_time'], confidence: 0.9, order: 1, isPrimary: false },
    { id: 'root_cause_manual_proposals', organizationId: scope.organizationId, workspaceId: scope.workspaceId, createdAt: detectedAt, updatedAt: detectedAt, issueId: 'issue_sales_conversion_decline', title: 'Manual proposal creation', explanation: 'Proposal context is assembled by hand across multiple tools.', contributingFactorIds: ['factor_knowledge_scattered'], evidenceIds: ['evidence_manual_proposals'], confidence: 0.86, order: 2, isPrimary: false },
    { id: 'root_cause_knowledge_scattered', organizationId: scope.organizationId, workspaceId: scope.workspaceId, createdAt: detectedAt, updatedAt: detectedAt, issueId: 'issue_sales_conversion_decline', title: 'Company knowledge is fragmented', explanation: 'Past proposals, pricing, and case studies are scattered across four tools.', contributingFactorIds: [], evidenceIds: ['evidence_manual_proposals'], confidence: 0.82, order: 3, isPrimary: true },
  ]
  const issue: Issue = { id: 'issue_sales_conversion_decline', organizationId: scope.organizationId, workspaceId: scope.workspaceId, createdAt: detectedAt, updatedAt: detectedAt, title: 'Sales conversion decline', description: 'Sales conversion declined as proposal turnaround slowed.', severity: 'high', category: 'Sales', signalIds: [signal.id], evidenceIds: evidence.map((item) => item.id), rootCauseIds: rootCauses.map((item) => item.id), impact: { estimatedRevenueUpside: 31000, estimatedAnnualValue: 31000, currency: 'USD' }, confidence: 0.86, status: 'open' }
  return { issue, evidence, rootCauses }
}

export interface OpportunityScoreInput { financialImpact: number; confidence: number; urgency: number; implementationDifficulty: number }

export function scoreOpportunity(input: OpportunityScoreInput): number {
  const score = input.financialImpact * input.confidence * input.urgency / Math.max(1, input.implementationDifficulty)
  return Math.round(score * 100) / 100
}

export function calculateROI(annualizedImpact: number, implementationCost: number): number {
  if (implementationCost <= 0) return annualizedImpact > 0 ? 999 : 0
  return Math.round((annualizedImpact / implementationCost) * 100) / 100
}

export interface HealthDimensionInput { key: string; label: string; score: number; weight: number; contributingSignalIds: string[] }
export interface HealthScore { overallScore: number; grade: string; trend: Signal['direction']; dimensions: HealthDimensionInput[] }

export function calculateHealthScore(dimensions: HealthDimensionInput[], previousScore?: number): HealthScore {
  const totalWeight = dimensions.reduce((sum, item) => sum + item.weight, 0)
  const overallScore = Math.round(dimensions.reduce((sum, item) => sum + item.score * item.weight, 0) / Math.max(1, totalWeight))
  return { overallScore, grade: overallScore >= 90 ? 'A' : overallScore >= 80 ? 'B+' : overallScore >= 70 ? 'B' : 'C', trend: previousScore === undefined || overallScore === previousScore ? 'flat' : overallScore > previousScore ? 'up' : 'down', dimensions }
}
