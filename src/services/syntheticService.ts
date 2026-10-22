import type { AgentRun, Approval, BusinessMetric, Evidence, Issue, MetricObservation, Opportunity, Recommendation, RootCause, Signal, ROIRecord } from '../../shared/domain/models'
import type { BusinessHealthScoreDTO, DashboardDTO } from '../../shared/contracts/dto'
import reviewFixture from '../data/reviewFixture.json'

export interface SyntheticSourceSummary { provider: string; displayName: string; status: 'connected' | 'needs_attention' | 'disconnected' | 'error'; mode: 'synthetic'; permission: 'observe' | 'recommend'; recordCount: number; lastSyncedAt: string; label: 'SYNTHETIC' }
export interface SyntheticExplorerRow { id: string; source: string; entityType: string; normalizedEntity: string; canonicalEntityId?: string; timestamp: string; relatedSignalIds: string[]; relatedOpportunityId?: string; preview: Record<string, string | number> }
export type SyntheticScenario = 'baseline' | 'low_confidence' | 'partial_coverage' | 'failed_action' | 'no_roi' | 'conflicting_evidence'
export type SyntheticBriefSection = 'Needs Attention' | 'Changes Since Last Brief' | 'Completed by Gilar' | 'Opportunities' | 'Watchlist'
export interface SyntheticBriefItem { id: string; section: SyntheticBriefSection; title: string; detail: string; priority: number; tone: 'red' | 'yellow' | 'blue' | 'green' | 'gray'; deepLink: string; evidenceIds: string[]; sourceLabels: string[]; status?: string }
export interface SyntheticActivityEvent { id: string; occurredAt: string; title: string; detail: string; recordType: string; recordId: string; status: string }
export interface SyntheticAgentRunView { id: string; status: AgentRun['status']; startedAt?: string; completedAt?: string; title: string; detail: string; recordType: string; recordId: string }
export interface SyntheticAgentActionView { id: string; title: string; status: string; requestedAt: string; approvedAt?: string; completedAt?: string; approvalRequired: boolean }
export interface SyntheticAgentView { agent: { id: string; name: string; description: string; status: string; requiredPermissions: string[]; configuration: Record<string, boolean | string | number> }; activity: string[]; tasks: string[]; results: string[]; businessImpact: string; permissions: string[]; currentTask: string; stats: { assisted: number; completedRuns: number; failedRuns: number; pendingApprovals: number; completedActions: number; hoursSaved: number; measuredImpact: number; estimatedImpact: number; successRate: number; directionalROI?: number }; runs: SyntheticAgentRunView[]; actions: SyntheticAgentActionView[]; approvals: Approval[]; timeline: SyntheticActivityEvent[] }
export interface SyntheticConflict { id: string; title: string; detail: string; sourceLabels: string[]; confidence: number; evidenceIds: string[] }
export interface SyntheticEdgeState { key: string; label: string; description: string; tone: 'info' | 'warning' | 'error'; actionLabel?: string; actionLink?: string }
export interface SyntheticSimulationSnapshot { demoOnly: true; scenario: string; status: 'baseline' | 'proposed' | 'approved' | 'running' | 'completed' | 'failed'; actionStatus: string; lifecycle: string[]; elapsedDays: number; targetDays: number; actionId?: string; interventionAt?: string; before: { proposalMinutes: number; leadResponseHours: number; conversionRate: number }; after?: { proposalMinutes: number; leadResponseHours: number; conversionRate: number }; outcome?: { id?: string; baselineValue: number; postInterventionValue: number; measuredAt?: string; timeSavedHours?: number; costSaved?: number; revenueGained?: number; annualizedImpact?: number; confidence: number }; roiRecord?: ROIRecord; failureReason?: string }
export interface SyntheticOverview {
  mode: 'synthetic'
  company: { name: string; industry: string; employeeCount: number; annualRevenueRange: string; customerCount: number; supplierCount: number; salesTeamSize: number; adminOpsTeamSize: number; historyStart: string; asOf: string }
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
}

const reviewMode = import.meta.env.VITE_GILAR_MODE === 'review'
const reviewStorageKey = 'gilar-review-state-v1'
const reviewClone = <T,>(value: T): T => structuredClone(value)
const reviewInitialState = reviewMode ? reviewClone(reviewFixture as unknown as SyntheticOverview) : undefined

function loadReviewState() {
  if (!reviewInitialState || typeof window === 'undefined') return reviewInitialState
  try {
    const stored = window.localStorage.getItem(reviewStorageKey)
    return stored ? reviewClone(JSON.parse(stored) as SyntheticOverview) : reviewClone(reviewInitialState)
  } catch {
    return reviewClone(reviewInitialState)
  }
}

let reviewState = loadReviewState()
let reviewActionCounter = 0

function currentReviewState() {
  if (!reviewState) throw new Error('Review mode is not enabled.')
  return reviewState
}

function saveReviewState() {
  if (reviewState && typeof window !== 'undefined') window.localStorage.setItem(reviewStorageKey, JSON.stringify(reviewState))
}

function reviewOverview() {
  return Promise.resolve(reviewClone(currentReviewState()))
}

function reviewEvidence(issueId?: string, opportunityId?: string) {
  const state = currentReviewState()
  return Promise.resolve(reviewClone(state.evidence.filter((item) => {
    const linked = item as Evidence & { issueId?: string; opportunityId?: string }
    return (!issueId || linked.issueId === issueId) && (!opportunityId || linked.opportunityId === opportunityId)
  })))
}

function reviewPropose(recommendationId: string) {
  const state = currentReviewState()
  const actionId = `review_action_${++reviewActionCounter}`
  state.simulation = { ...state.simulation, status: 'proposed', actionStatus: 'awaiting_approval', actionId, lifecycle: ['proposed', 'awaiting_approval'] }
  saveReviewState()
  return Promise.resolve({ id: actionId, status: 'awaiting_approval' })
}

function reviewApprove(actionId: string) {
  const state = currentReviewState()
  state.simulation = { ...state.simulation, status: 'approved', actionStatus: 'approved', actionId, lifecycle: ['proposed', 'awaiting_approval', 'approved'] }
  saveReviewState()
  return Promise.resolve({ id: actionId, status: 'approved' })
}

function reviewDeploy(actionId: string) {
  const state = currentReviewState()
  if (state.scenario === 'failed_action') {
    state.simulation = { ...state.simulation, status: 'failed', actionStatus: 'failed', actionId, lifecycle: ['proposed', 'awaiting_approval', 'approved', 'queued', 'failed'], failureReason: 'The simulated target system rejected the action.' }
    saveReviewState()
    return Promise.resolve({ id: actionId, status: 'failed' })
  }
  state.simulation = { ...state.simulation, status: 'running', actionStatus: 'running', actionId, interventionAt: state.company.asOf, lifecycle: ['proposed', 'awaiting_approval', 'approved', 'queued', 'running'] }
  saveReviewState()
  return Promise.resolve({ id: actionId, status: 'running' })
}

function reviewAdvance(days: number) {
  const state = currentReviewState()
  if (!Number.isFinite(days) || days <= 0 || days > 365) return Promise.reject(new Error('Simulation days must be between 1 and 365.'))
  if (state.simulation.status === 'baseline') return Promise.reject(new Error('Deploy the synthetic recommendation before advancing the simulation.'))
  if (state.simulation.status === 'failed') return Promise.reject(new Error(state.simulation.failureReason ?? 'The synthetic action failed.'))
  const elapsedDays = Math.min(state.simulation.targetDays, state.simulation.elapsedDays + Math.floor(days))
  if (elapsedDays < state.simulation.targetDays) {
    state.simulation = { ...state.simulation, elapsedDays }
    saveReviewState()
    return Promise.resolve(reviewClone(state.simulation))
  }

  if (state.scenario === 'no_roi') {
    state.simulation = { ...state.simulation, status: 'completed', actionStatus: 'completed', elapsedDays, lifecycle: ['proposed', 'awaiting_approval', 'approved', 'queued', 'running', 'completed'], outcome: undefined, roiRecord: undefined }
    state.roiRecords = []
    saveReviewState()
    return Promise.resolve(reviewClone(state.simulation))
  }

  const measuredAt = new Date(new Date(state.company.asOf).getTime() + state.simulation.targetDays * 86_400_000).toISOString()
  const after = { proposalMinutes: 58, leadResponseHours: 4.2, conversionRate: 0.27 }
  const outcome = {
    id: 'outcome_proposal_intelligence',
    baselineValue: state.simulation.before.proposalMinutes,
    postInterventionValue: after.proposalMinutes,
    measuredAt,
    timeSavedHours: 116,
    costSaved: 4870,
    revenueGained: 37000,
    annualizedImpact: 41870,
    confidence: 0.87,
  }
  const roiRecord: ROIRecord = {
    id: 'roi_review_proposal_intelligence',
    organizationId: 'org_northstar_review',
    workspaceId: 'ws_northstar_review',
    createdAt: measuredAt,
    updatedAt: measuredAt,
    outcomeId: outcome.id,
    baselineMetric: 'Average proposal preparation time',
    postInterventionMetric: 'Average proposal preparation time',
    timeSavedHours: outcome.timeSavedHours,
    costSaved: outcome.costSaved,
    revenueGained: outcome.revenueGained,
    annualizedImpact: outcome.annualizedImpact,
    confidence: outcome.confidence,
    measurementPeriodStart: state.company.asOf,
    measurementPeriodEnd: measuredAt,
    measurementWindowDays: state.simulation.targetDays,
    formula: 'Measured savings + measured revenue gain',
    assumptions: ['Blended hourly cost: $42', 'Revenue gain is attributed to measured conversion improvement'],
    measuredComponents: ['Proposal preparation time', 'Lead response time', 'Conversion rate'],
    estimatedComponents: ['Annualized impact'],
    sourceMetricIds: ['metric_syn_response', 'metric_syn_conversion'],
  }
  state.simulation = { ...state.simulation, status: 'completed', actionStatus: 'completed', elapsedDays, after, outcome, roiRecord, lifecycle: ['proposed', 'awaiting_approval', 'approved', 'queued', 'running', 'completed'] }
  state.roiRecords = [roiRecord]
  saveReviewState()
  return Promise.resolve(reviewClone(state.simulation))
}

function reviewReset() {
  reviewState = reviewInitialState ? reviewClone(reviewInitialState) : undefined
  if (typeof window !== 'undefined') window.localStorage.removeItem(reviewStorageKey)
  return reviewOverview()
}

function reviewSetScenario(scenario: SyntheticScenario) {
  const state = currentReviewState()
  state.scenario = scenario
  state.simulation = { ...state.simulation, scenario, status: 'baseline', actionStatus: 'none', actionId: undefined, elapsedDays: 0, after: undefined, outcome: undefined, roiRecord: undefined, failureReason: undefined, lifecycle: [] }
  state.roiRecords = []
  saveReviewState()
  return reviewOverview()
}

function reviewMutationId(prefix: string) {
  return Promise.resolve({ id: `review_${prefix}_${Date.now()}` })
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init })
  const body = await response.json() as { data?: T; error?: { message?: string } }
  if (!response.ok || !body.data) throw new Error(body.error?.message ?? `Synthetic API request failed (${response.status}).`)
  return body.data
}

export const syntheticApi = {
  overview: () => reviewMode ? reviewOverview() : request<SyntheticOverview>('/api/synthetic/overview'),
  evidence: (issueId?: string, opportunityId?: string) => reviewMode ? reviewEvidence(issueId, opportunityId) : request<Evidence[]>(`/api/synthetic/evidence?${new URLSearchParams({ ...(issueId ? { issueId } : {}), ...(opportunityId ? { opportunityId } : {}) })}`),
  propose: (recommendationId: string) => reviewMode ? reviewPropose(recommendationId) : request<{ id: string; status: string }>('/api/actions', { method: 'POST', body: JSON.stringify({ recommendationId, targetSystem: 'internal', operation: 'deploy_synthetic_proposal_intelligence', requireApproval: true }) }),
  approve: (actionId: string) => reviewMode ? reviewApprove(actionId) : request<{ id: string; status: string }>(`/api/actions/${encodeURIComponent(actionId)}/approve`, { method: 'POST', body: JSON.stringify({}) }),
  deploy: (actionId: string) => reviewMode ? reviewDeploy(actionId) : request<{ id: string; status: string }>(`/api/actions/${encodeURIComponent(actionId)}/deploy`, { method: 'POST', body: JSON.stringify({}) }),
  advance: (days: number) => reviewMode ? reviewAdvance(days) : request<SyntheticSimulationSnapshot>('/api/synthetic/simulation/advance', { method: 'POST', body: JSON.stringify({ days }) }),
  reset: () => reviewMode ? reviewReset() : request<SyntheticOverview>('/api/synthetic/reset', { method: 'POST', body: JSON.stringify({}) }),
  setScenario: (scenario: SyntheticScenario) => reviewMode ? reviewSetScenario(scenario) : request<SyntheticOverview>('/api/synthetic/scenario', { method: 'POST', body: JSON.stringify({ scenario }) }),
  feedback: (input: { screen: string; entityType: string; entityId?: string; opportunityId?: string; recommendationId?: string; helpful: boolean; comment?: string }) => reviewMode ? reviewMutationId('feedback') : request<{ id: string }>('/api/pilot/feedback', { method: 'POST', body: JSON.stringify(input) }),
  telemetry: (input: { event: string; screen: string; entityType?: string; entityId?: string }) => reviewMode ? reviewMutationId('telemetry') : request<{ id: string }>('/api/pilot/telemetry', { method: 'POST', body: JSON.stringify(input) }),
}

