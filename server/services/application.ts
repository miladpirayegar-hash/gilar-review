import type {
  Action,
  Agent,
  AuditEvent,
  BusinessMetric,
  Evidence,
  Insight,
  Integration,
  Issue,
  MetricObservation,
  Notification,
  Opportunity,
  Organization,
  Outcome,
  Recommendation,
  ROIRecord,
  RootCause,
  Signal,
  Solution,
  TenantScope,
  User,
  Workspace,
} from '../../shared/domain/models'
import { canUseIntegrationLevel, hasPermission } from '../../shared/permissions'
import type { DashboardDTO, OpportunityDTO } from '../../shared/contracts/dto'
import { demoAgents, demoIntegrations, demoMembership, demoMetrics, demoNotifications, demoOpportunities, demoOrganization, demoRecommendations, demoROIRecords, demoScope, demoSolutions, demoUser, demoWorkspace, demoObservations, createDemoDiagnosis, createDemoEvidence, createDemoSignals } from '../demo/fixtures'
import { calculateHealthScore, type HealthScore } from './bi'
import { getTenantEntityOrThrow, InMemoryTenantRepository } from '../repositories/inMemory'
import { TenantAccessError } from '../repositories/interfaces'
import type { AuthSession } from '../auth'

export interface CreateActionInput {
  recommendationId?: string
  targetSystem: Action['targetSystem']
  operation: string
  requireApproval?: boolean
}

export interface ApplicationServices {
  organizationService: { get: (scope: TenantScope) => Promise<Organization> }
  workspaceService: { get: (scope: TenantScope) => Promise<Workspace> }
  metricService: { list: (scope: TenantScope) => Promise<BusinessMetric[]>; listObservations: (scope: TenantScope) => Promise<MetricObservation[]> }
  signalService: { list: (scope: TenantScope) => Promise<Signal[]>; get: (scope: TenantScope, id: string) => Promise<Signal> }
  diagnosisService: { getIssue: (scope: TenantScope, id: string) => Promise<Issue>; getRootCauses: (scope: TenantScope, issueId: string) => Promise<RootCause[]>; getEvidence: (scope: TenantScope, issueId: string) => Promise<Evidence[]> }
  opportunityService: { list: (scope: TenantScope) => Promise<Opportunity[]>; get: (scope: TenantScope, id: string) => Promise<Opportunity> }
  recommendationService: { list: (scope: TenantScope) => Promise<Recommendation[]>; get: (scope: TenantScope, id: string) => Promise<Recommendation> }
  solutionService: { list: (scope: TenantScope) => Promise<Solution[]>; get: (scope: TenantScope, id: string) => Promise<Solution> }
  agentService: { list: (scope: TenantScope) => Promise<Agent[]> }
  actionService: { get: (scope: TenantScope, id: string) => Promise<Action>; propose: (scope: TenantScope, session: AuthSession, input: CreateActionInput) => Promise<Action>; approve: (scope: TenantScope, session: AuthSession, id: string) => Promise<Action>; deploy: (scope: TenantScope, session: AuthSession, id: string) => Promise<Action>; complete: (scope: TenantScope, session: AuthSession, id: string) => Promise<Action> }
  auditService: { list: (scope: TenantScope) => Promise<AuditEvent[]>; record: (scope: TenantScope, event: Omit<AuditEvent, 'id' | 'organizationId' | 'workspaceId' | 'createdAt' | 'updatedAt'>) => Promise<AuditEvent> }
  outcomeService: { list: (scope: TenantScope) => Promise<Outcome[]> }
  insightService: { list: (scope: TenantScope) => Promise<Insight[]> }
  notificationService: { list: (scope: TenantScope, userId?: string) => Promise<Notification[]> }
  healthScoreService: { get: (scope: TenantScope) => Promise<HealthScore> }
  dashboardService: { get: (scope: TenantScope) => Promise<DashboardDTO> }
  roiService: { list: (scope: TenantScope) => Promise<ROIRecord[]> }
  integrationService: { list: (scope: TenantScope) => Promise<Integration[]> }
  userService: { getCurrent: (session: AuthSession) => Promise<User> }
}

function toOpportunityDTO(opportunity: Opportunity): OpportunityDTO {
  return {
    id: opportunity.id,
    title: opportunity.title,
    category: opportunity.category,
    summary: opportunity.summary,
    estimatedAnnualValue: opportunity.estimatedAnnualValue,
    estimatedSavings: opportunity.estimatedSavings,
    estimatedRevenueUpside: opportunity.estimatedRevenueUpside,
    roi: opportunity.roi,
    urgency: opportunity.urgency,
    confidence: opportunity.confidence,
    implementationDifficulty: opportunity.implementationDifficulty,
    priorityScore: opportunity.priorityScore,
    status: opportunity.status,
    issueId: opportunity.issueId,
    evidenceIds: opportunity.evidenceIds,
    recommendedAction: opportunity.recommendedAction,
    sourceSystem: opportunity.sourceSystem,
    analysisPeriod: opportunity.analysisPeriod,
    impactOrigin: opportunity.impactOrigin,
  }
}

export function createDemoApplicationServices(): ApplicationServices {
  const diagnosis = createDemoDiagnosis()
  const scope = demoScope
  const issues = new InMemoryTenantRepository<Issue>([diagnosis.issue])
  const rootCauses = new InMemoryTenantRepository<RootCause>(diagnosis.rootCauses)
  const evidence = new InMemoryTenantRepository<Evidence>(createDemoEvidence())
  const metrics = new InMemoryTenantRepository<BusinessMetric>(demoMetrics)
  const observations = new InMemoryTenantRepository<MetricObservation>(demoObservations)
  const signals = new InMemoryTenantRepository<Signal>(createDemoSignals())
  const opportunities = new InMemoryTenantRepository<Opportunity>(demoOpportunities)
  const recommendations = new InMemoryTenantRepository<Recommendation>(demoRecommendations)
  const solutions = new InMemoryTenantRepository<Solution>(demoSolutions)
  const agents = new InMemoryTenantRepository<Agent>(demoAgents)
  const integrations = new InMemoryTenantRepository<Integration>(demoIntegrations)
  const actions = new InMemoryTenantRepository<Action>([])
  const auditEvents = new InMemoryTenantRepository<AuditEvent>([])
  const outcomes = new InMemoryTenantRepository<Outcome>([])
  const insights = new InMemoryTenantRepository<Insight>([
    {
      id: 'insight_sales_conversion',
      ...scope,
      createdAt: '2026-10-21T08:00:00.000Z',
      updatedAt: '2026-10-21T08:00:00.000Z',
      title: 'Proposal turnaround is the clearest growth lever',
      summary: 'Faster response times and stronger follow-up coverage are the highest-confidence path to recovering conversion.',
      category: 'Growth',
      sourceIds: ['signal_conversion_decline', 'signal_response_time_increase'],
      generatedAt: '2026-10-21T08:00:00.000Z',
      status: 'new',
      aiProvenance: { provider: 'gilar-deterministic', model: 'rules-v1', generatedAt: '2026-10-21T08:00:00.000Z', promptVersion: 'none', confidence: 0.86, sourceEvidenceIds: ['evidence_response_time', 'evidence_follow_up_coverage'] },
    },
  ])
  const notifications = new InMemoryTenantRepository<Notification>(demoNotifications)
  const roiRecords = new InMemoryTenantRepository<ROIRecord>(demoROIRecords)

  const organizationService = { get: async (requestedScope: TenantScope) => {
    if (requestedScope.organizationId !== demoOrganization.id) throw new TenantAccessError()
    return demoOrganization
  } }
  const workspaceService = { get: (requestedScope: TenantScope) => getTenantEntityOrThrow(new InMemoryTenantRepository<Workspace>([demoWorkspace]), requestedScope, demoWorkspace.id) }
  const metricService = { list: (requestedScope: TenantScope) => metrics.list(requestedScope), listObservations: (requestedScope: TenantScope) => observations.list(requestedScope) }
  const signalService = { list: (requestedScope: TenantScope) => signals.list(requestedScope), get: (requestedScope: TenantScope, id: string) => getTenantEntityOrThrow(signals, requestedScope, id) }
  const diagnosisService = {
    getIssue: (requestedScope: TenantScope, id: string) => getTenantEntityOrThrow(issues, requestedScope, id),
    getRootCauses: async (requestedScope: TenantScope, issueId: string) => (await rootCauses.list(requestedScope)).filter((rootCause) => rootCause.issueId === issueId).sort((a, b) => a.order - b.order),
    getEvidence: async (requestedScope: TenantScope, issueId: string) => {
      const issue = await getTenantEntityOrThrow(issues, requestedScope, issueId)
      const evidenceIds = new Set(issue.evidenceIds)
      return (await evidence.list(requestedScope)).filter((item) => evidenceIds.has(item.id))
    },
  }
  const opportunityService = { list: (requestedScope: TenantScope) => opportunities.list(requestedScope), get: (requestedScope: TenantScope, id: string) => getTenantEntityOrThrow(opportunities, requestedScope, id) }
  const recommendationService = { list: (requestedScope: TenantScope) => recommendations.list(requestedScope), get: (requestedScope: TenantScope, id: string) => getTenantEntityOrThrow(recommendations, requestedScope, id) }
  const solutionService = { list: (requestedScope: TenantScope) => solutions.list(requestedScope), get: (requestedScope: TenantScope, id: string) => getTenantEntityOrThrow(solutions, requestedScope, id) }
  const agentService = { list: (requestedScope: TenantScope) => agents.list(requestedScope) }
  const integrationService = { list: (requestedScope: TenantScope) => integrations.list(requestedScope) }
  const actionService = {
    get: (requestedScope: TenantScope, id: string) => getTenantEntityOrThrow(actions, requestedScope, id),
    propose: async (requestedScope: TenantScope, session: AuthSession, input: CreateActionInput) => {
      if (!hasPermission(session.membership, 'manage_agents')) throw new Error('You do not have permission to propose actions.')
      if (!canUseIntegrationLevel(session.membership, input.requireApproval === false ? 'act' : 'recommend')) throw new Error('Your role cannot use this action level.')
      if (input.recommendationId) {
        try { await recommendationService.get(requestedScope, input.recommendationId) } catch (error) {
          if (!input.recommendationId.startsWith('recommendation_opportunity_')) throw error
        }
      }
      const timestamp = new Date().toISOString()
      const actionId = `action_${crypto.randomUUID()}`
      const auditEventId = `audit_${crypto.randomUUID()}`
      await auditEvents.create(requestedScope, { id: auditEventId, ...requestedScope, createdAt: timestamp, updatedAt: timestamp, actorUserId: session.user.id, action: 'action.proposed', resourceType: 'action', resourceId: actionId, occurredAt: timestamp, details: { targetSystem: input.targetSystem, operation: input.operation } })
      const action: Action = {
        id: actionId,
        ...requestedScope,
        createdAt: timestamp,
        updatedAt: timestamp,
        recommendationId: input.recommendationId,
        proposedByUserId: session.user.id,
        status: input.requireApproval === false ? 'queued' : 'awaiting_approval',
        targetSystem: input.targetSystem,
        operation: input.operation,
        requestedAt: timestamp,
        auditEventIds: [auditEventId],
      }
      return actions.create(requestedScope, action)
    },
    approve: async (requestedScope: TenantScope, session: AuthSession, id: string) => {
      if (!hasPermission(session.membership, 'approve_actions')) throw new Error('You do not have permission to approve actions.')
      const current = await getTenantEntityOrThrow(actions, requestedScope, id)
      if (current.status !== 'awaiting_approval') throw new Error('Only actions awaiting approval can be approved.')
      const approvedAt = new Date().toISOString()
      const auditEventId = `audit_${crypto.randomUUID()}`
      await auditEvents.create(requestedScope, { id: auditEventId, ...requestedScope, createdAt: approvedAt, updatedAt: approvedAt, actorUserId: session.user.id, action: 'action.approved', resourceType: 'action', resourceId: current.id, occurredAt: approvedAt, details: { previousStatus: current.status } })
      const updated: Action = { ...current, status: 'approved', approvedByUserId: session.user.id, approvedAt, updatedAt: approvedAt, auditEventIds: [...current.auditEventIds, auditEventId] }
      await actions.replace(requestedScope, updated)
      return updated
    },
    deploy: async (requestedScope: TenantScope, session: AuthSession, id: string) => {
      if (!hasPermission(session.membership, 'manage_agents')) throw new Error('You do not have permission to deploy actions.')
      const current = await getTenantEntityOrThrow(actions, requestedScope, id)
      if (current.status !== 'approved') throw new Error('Only approved actions can be deployed.')
      const deployedAt = new Date().toISOString()
      const auditEventId = `audit_${crypto.randomUUID()}`
      await auditEvents.create(requestedScope, { id: auditEventId, ...requestedScope, createdAt: deployedAt, updatedAt: deployedAt, actorUserId: session.user.id, action: 'action.deployed', resourceType: 'action', resourceId: current.id, occurredAt: deployedAt, details: { previousStatus: current.status } })
      const updated: Action = { ...current, status: 'running', updatedAt: deployedAt, auditEventIds: [...current.auditEventIds, auditEventId] }
      await actions.replace(requestedScope, updated)
      return updated
    },
    complete: async (requestedScope: TenantScope, session: AuthSession, id: string) => {
      if (!hasPermission(session.membership, 'manage_agents')) throw new Error('You do not have permission to complete actions.')
      const current = await getTenantEntityOrThrow(actions, requestedScope, id)
      if (current.status !== 'running') throw new Error('Only running actions can be completed.')
      const completedAt = new Date().toISOString()
      const auditEventId = `audit_${crypto.randomUUID()}`
      await auditEvents.create(requestedScope, { id: auditEventId, ...requestedScope, createdAt: completedAt, updatedAt: completedAt, actorUserId: session.user.id, action: 'action.completed', resourceType: 'action', resourceId: current.id, occurredAt: completedAt, details: { previousStatus: current.status } })
      const updated: Action = { ...current, status: 'completed', completedAt, updatedAt: completedAt, auditEventIds: [...current.auditEventIds, auditEventId] }
      await actions.replace(requestedScope, updated)
      return updated
    },
  }
  const outcomeService = { list: (requestedScope: TenantScope) => outcomes.list(requestedScope) }
  const insightService = { list: (requestedScope: TenantScope) => insights.list(requestedScope) }
  const notificationService = { list: async (requestedScope: TenantScope, userId?: string) => { const rows = await notifications.list(requestedScope); return userId ? rows.filter((row) => !row.userId || row.userId === userId) : rows } }
  const healthScoreService = { get: async (requestedScope: TenantScope) => {
    const requestedSignals = await signalService.list(requestedScope)
    return calculateHealthScore([
      { key: 'financial', label: 'Financial Health', score: requestedSignals.some((signal) => signal.metricId === 'metric_overdue_invoices') ? 76 : 88, weight: 0.2, contributingSignalIds: requestedSignals.filter((signal) => signal.metricId === 'metric_overdue_invoices').map((signal) => signal.id) },
      { key: 'sales_customers', label: 'Sales & Customers', score: requestedSignals.some((signal) => signal.metricId === 'metric_conversion') ? 58 : 82, weight: 0.22, contributingSignalIds: requestedSignals.filter((signal) => signal.metricId === 'metric_conversion' || signal.metricId === 'metric_response_time').map((signal) => signal.id) },
      { key: 'operations', label: 'Operations', score: requestedSignals.some((signal) => signal.metricId === 'metric_inventory') ? 72 : 86, weight: 0.15, contributingSignalIds: requestedSignals.filter((signal) => signal.metricId === 'metric_inventory').map((signal) => signal.id) },
      { key: 'people_productivity', label: 'People & Productivity', score: requestedSignals.some((signal) => signal.metricId === 'metric_admin_workload') ? 70 : 84, weight: 0.12, contributingSignalIds: requestedSignals.filter((signal) => signal.metricId === 'metric_admin_workload').map((signal) => signal.id) },
      { key: 'marketing_growth', label: 'Marketing & Growth', score: 82, weight: 0.1, contributingSignalIds: [] },
      { key: 'tools_subscriptions', label: 'Tools & Subscriptions', score: requestedSignals.some((signal) => signal.metricId === 'metric_software_spend') ? 68 : 84, weight: 0.08, contributingSignalIds: requestedSignals.filter((signal) => signal.metricId === 'metric_software_spend').map((signal) => signal.id) },
      { key: 'risk_compliance', label: 'Risk & Compliance', score: 84, weight: 0.08, contributingSignalIds: [] },
      { key: 'market_opportunities', label: 'Market Opportunities', score: 81, weight: 0.05, contributingSignalIds: [] },
    ])
  } }
  const dashboardService = { get: async (requestedScope: TenantScope): Promise<DashboardDTO> => {
    const workspace = await workspaceService.get(requestedScope)
    const requestedSignals = await signalService.list(requestedScope)
    const requestedOpportunities = await opportunityService.list(requestedScope)
    return {
      workspace: { id: workspace.id, name: workspace.name, organizationId: workspace.organizationId },
      metrics: [
        { key: 'revenue', label: 'Revenue', value: '$842K', change: '+6.4%', trend: 'up' },
        { key: 'cash_position', label: 'Cash Position', value: '$124K', change: 'Stable', trend: 'flat' },
        { key: 'pipeline', label: 'Pipeline', value: '$310K', change: '-11%', trend: 'down' },
        { key: 'overdue_invoices', label: 'Overdue Invoices', value: '$18,420', change: `${requestedSignals.filter((signal) => signal.metricId === 'metric_overdue_invoices').length} signal`, trend: 'down' },
      ],
      attention: requestedOpportunities.slice(0, 3).map((opportunity) => ({ issueId: opportunity.issueId, title: opportunity.title, detail: opportunity.summary, severity: requestedSignals.some((signal) => signal.severity === 'high') ? 'high' as const : 'medium' as const, deepLink: `/app/opportunities/${opportunity.id}` })),
    }
  } }

  return {
    organizationService,
    workspaceService,
    metricService,
    signalService,
    diagnosisService,
    opportunityService,
    recommendationService,
    solutionService,
    agentService,
    actionService,
    auditService: {
      list: (requestedScope: TenantScope) => auditEvents.list(requestedScope),
      record: async (requestedScope: TenantScope, event: Omit<AuditEvent, 'id' | 'organizationId' | 'workspaceId' | 'createdAt' | 'updatedAt'>) => {
        const timestamp = new Date().toISOString()
        return auditEvents.create(requestedScope, { ...event, id: `audit_${crypto.randomUUID()}`, ...requestedScope, createdAt: timestamp, updatedAt: timestamp })
      },
    },
    outcomeService,
    insightService,
    notificationService,
    healthScoreService,
    dashboardService,
    roiService: { list: (requestedScope: TenantScope) => roiRecords.list(requestedScope) },
    integrationService,
    userService: { getCurrent: async (session: AuthSession) => session.user },
  }
}

export { toOpportunityDTO }
