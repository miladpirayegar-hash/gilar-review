import type { Agent, BusinessMetric, Evidence, Integration, Membership, MetricObservation, Notification, Opportunity, Organization, Recommendation, ROIRecord, Solution, TenantScope, User, Workspace } from '../../shared/domain/models'
import { buildSalesConversionDiagnosis, calculateROI, detectSignals, scoreOpportunity } from '../services/bi'

export const demoScope: TenantScope = { organizationId: 'org_northstar_demo', workspaceId: 'ws_northstar_demo' }
const createdAt = '2026-10-21T08:00:00.000Z'
const base = { ...demoScope, createdAt, updatedAt: createdAt }

export const demoOrganization: Organization = { id: demoScope.organizationId, name: 'Northstar Studio', slug: 'northstar-studio', status: 'active', createdAt, updatedAt: createdAt }
export const demoWorkspace: Workspace = { id: demoScope.workspaceId, ...base, name: 'Northstar Studio', slug: 'northstar-studio', timezone: 'America/Los_Angeles', currency: 'USD', status: 'active' }
export const demoUser: User = { id: 'user_milad_demo', email: 'milad@company.com', displayName: 'Milad Pira', status: 'active', createdAt, updatedAt: createdAt }
export const demoMembership: Membership = { id: 'membership_milad_northstar', userId: demoUser.id, ...demoScope, role: 'Owner', status: 'active', createdAt, updatedAt: createdAt }

export const demoIntegrations: Integration[] = [
  { id: 'integration_quickbooks', ...base, provider: 'quickbooks', displayName: 'QuickBooks', status: 'connected', permissionLevel: 'observe', lastSyncedAt: createdAt },
  { id: 'integration_gmail', ...base, provider: 'gmail', displayName: 'Gmail', status: 'connected', permissionLevel: 'recommend', lastSyncedAt: createdAt },
  { id: 'integration_google_drive', ...base, provider: 'google_drive', displayName: 'Google Drive', status: 'connected', permissionLevel: 'observe', lastSyncedAt: createdAt },
  { id: 'integration_slack', ...base, provider: 'slack', displayName: 'Slack', status: 'connected', permissionLevel: 'observe', lastSyncedAt: createdAt },
]

export const demoMetrics: BusinessMetric[] = [
  { id: 'metric_conversion', ...base, key: 'conversion_decline', name: 'Sales conversion rate', category: 'sales', unit: 'percentage', status: 'active' },
  { id: 'metric_response_time', ...base, key: 'response_time_increase', name: 'Proposal response time', category: 'sales', unit: 'days', status: 'active' },
  { id: 'metric_overdue_invoices', ...base, key: 'overdue_invoice_increase', name: 'Overdue invoice exposure', category: 'financial', unit: 'currency', status: 'active' },
  { id: 'metric_inventory', ...base, key: 'inventory_shortage', name: 'Product X projected inventory', category: 'operations', unit: 'days', status: 'active' },
  { id: 'metric_software_spend', ...base, key: 'software_spend_anomaly', name: 'Software spend', category: 'tools', unit: 'currency', status: 'active' },
  { id: 'metric_admin_workload', ...base, key: 'administrative_workload', name: 'Administrative workload', category: 'productivity', unit: 'number', status: 'active' },
]

export const demoObservations: MetricObservation[] = demoMetrics.flatMap((metric) => {
  const values: Record<string, [number, number]> = {
    conversion_decline: [0.086, 0.1],
    response_time_increase: [4.3, 2.1],
    overdue_invoice_increase: [42000, 25000],
    inventory_shortage: [12, 24],
    software_spend_anomaly: [9600, 7200],
    administrative_workload: [48, 36],
  }
  const [currentValue, baselineValue] = values[metric.key]
  return [
    { id: `${metric.id}_current`, ...base, metricId: metric.id, value: currentValue, observedAt: createdAt, periodStart: '2026-09-21T00:00:00.000Z', periodEnd: createdAt, sourceRecordIds: [`record_${metric.key}_current`] },
    { id: `${metric.id}_baseline`, ...base, metricId: metric.id, value: baselineValue, observedAt: createdAt, periodStart: '2026-08-21T00:00:00.000Z', periodEnd: '2026-09-20T00:00:00.000Z', sourceRecordIds: [`record_${metric.key}_baseline`] },
  ]
})

export function createDemoSignals() {
  return detectSignals(demoScope, demoMetrics.map((metric) => {
    const current = demoObservations.find((observation) => observation.metricId === metric.id && observation.id.endsWith('_current'))!
    const baseline = demoObservations.find((observation) => observation.metricId === metric.id && observation.id.endsWith('_baseline'))!
    return { metric, currentValue: current.value, baselineValue: baseline.value, observedAt: current.observedAt, observationIds: [current.id, baseline.id], sourceId: metric.id === 'metric_response_time' ? 'integration_gmail' : 'integration_quickbooks' }
  }))
}

export function createDemoDiagnosis() {
  const signal = createDemoSignals().find((item) => item.id === 'signal_conversion_decline')!
  return buildSalesConversionDiagnosis(demoScope, signal, createdAt)
}

export const demoOpportunities: Opportunity[] = [
  { id: 'opportunity_invoice_follow_up', ...base, issueId: 'issue_invoice_follow_up', title: 'Automate invoice follow-up', category: 'Finance', summary: 'Recover at-risk revenue by adding a timely follow-up sequence for overdue customers.', evidenceIds: ['evidence_overdue_invoices'], estimatedAnnualValue: 54000, estimatedSavings: 0, estimatedRevenueUpside: 54000, roi: calculateROI(54000, 12000), urgency: 0.95, confidence: 0.94, implementationDifficulty: 1, priorityScore: scoreOpportunity({ financialImpact: 54000, confidence: .94, urgency: .95, implementationDifficulty: 1 }), status: 'prioritized' },
  { id: 'opportunity_software_costs', ...base, issueId: 'issue_software_spend', title: 'Reduce software costs', category: 'Operations', summary: 'Consolidate overlapping, under-used subscriptions and avoid unnecessary recurring spend.', evidenceIds: ['evidence_software_spend'], estimatedAnnualValue: 9600, estimatedSavings: 9600, estimatedRevenueUpside: 0, roi: calculateROI(9600, 2400), urgency: 0.62, confidence: 0.89, implementationDifficulty: 1, priorityScore: scoreOpportunity({ financialImpact: 9600, confidence: .89, urgency: .62, implementationDifficulty: 1 }), status: 'identified' },
  { id: 'opportunity_lead_response', ...base, issueId: 'issue_sales_conversion_decline', rootCauseId: 'root_cause_response_time', title: 'Improve lead response time', category: 'Growth', summary: 'Bring proposal response time back under two days with a guided proposal workflow.', evidenceIds: ['evidence_response_time', 'evidence_follow_up_coverage'], estimatedAnnualValue: 31000, estimatedSavings: 19200, estimatedRevenueUpside: 31000, roi: calculateROI(31000, 7400), urgency: 0.88, confidence: 0.86, implementationDifficulty: 2, priorityScore: scoreOpportunity({ financialImpact: 31000, confidence: .86, urgency: .88, implementationDifficulty: 2 }), status: 'prioritized' },
  { id: 'opportunity_admin_work', ...base, issueId: 'issue_admin_workload', rootCauseId: 'root_cause_manual_proposals', title: 'Reduce administrative work', category: 'Productivity', summary: 'Automate proposal context gathering and reclaim time for higher-value work.', evidenceIds: ['evidence_manual_proposals'], estimatedAnnualValue: 19200, estimatedSavings: 19200, estimatedRevenueUpside: 0, roi: calculateROI(19200, 4800), urgency: 0.74, confidence: 0.91, implementationDifficulty: 1, priorityScore: scoreOpportunity({ financialImpact: 19200, confidence: .91, urgency: .74, implementationDifficulty: 1 }), status: 'identified' },
]

export const demoSolutions: Solution[] = [{ id: 'solution_proposal_intelligence', ...base, name: 'Proposal Intelligence Agent', description: 'Creates personalized proposal drafts from successful past examples and client context.', implementationComplexity: 'low', requiredPermissions: ['observe', 'recommend'], approvalRequired: true }]
export const demoRecommendations: Recommendation[] = [{ id: 'recommendation_proposal_intelligence', ...base, opportunityId: 'opportunity_lead_response', solutionId: 'solution_proposal_intelligence', rationale: 'A guided proposal workflow directly addresses the response-time root cause and reduces manual context gathering.', evidenceIds: ['evidence_response_time', 'evidence_manual_proposals', 'evidence_follow_up_coverage'], expectedBenefit: 'Reduce proposal turnaround from 4.3 days to under 2 days.', expectedROI: 2.22, estimatedTimeSavedHours: 28, implementationComplexity: 'low', confidence: .86, risks: ['Draft quality should be reviewed during initial rollout.'], requiredPermissions: ['observe', 'recommend'], approvalRequired: true, status: 'ready' }]
export const demoAgents: Agent[] = [{ id: 'agent_proposal_intelligence', ...base, name: 'Proposal Intelligence', description: 'Turns scattered context into clear, on-brand proposals in minutes.', status: 'active', requiredPermissions: ['observe', 'recommend'], configuration: { approvalRequired: true, draftOnly: true } }]
export const demoROIRecords: ROIRecord[] = [{ id: 'roi_proposal_intelligence', ...base, outcomeId: 'outcome_proposal_intelligence', baselineMetric: '4.2 hours per proposal', postInterventionMetric: '47 minutes per proposal', timeSavedHours: 28, costSaved: 0, revenueGained: 31000, annualizedImpact: 16400, confidence: .82, measurementPeriodStart: '2026-09-01T00:00:00.000Z', measurementPeriodEnd: createdAt }]
export const demoNotifications: Notification[] = [{ id: 'notification_proposal_turnaround', ...base, userId: demoUser.id, type: 'opportunity', title: 'Proposal turnaround increased from 2.1 to 4.3 days', description: 'Gilar found a high-impact fix for your sales workflow.', deepLink: '/app/opportunities/root-cause' }, { id: 'notification_report_ready', ...base, userId: demoUser.id, type: 'update', title: 'New weekly business report is ready', description: 'Your latest insights and ROI summary are available.', deepLink: '/app/insights' }]

export function createDemoEvidence(): Evidence[] {
  const diagnosis = createDemoDiagnosis()
  return [...diagnosis.evidence, { id: 'evidence_overdue_invoices', ...base, sourceSystem: 'quickbooks', sourceRecordId: 'invoice_aging_report', signalId: 'signal_overdue_invoice_increase', observedValue: 42000, comparisonValue: 25000, observedAt: createdAt, description: '11 overdue customer accounts represent $42,000 in potential revenue at risk.', strength: .95, relevance: .94 }, { id: 'evidence_software_spend', ...base, sourceSystem: 'quickbooks', sourceRecordId: 'subscription_expenses', signalId: 'signal_software_spend_anomaly', observedValue: 9600, comparisonValue: 7200, observedAt: createdAt, description: 'Recurring software spend increased while seat utilization fell below 35%.', strength: .83, relevance: .85 }]
}
