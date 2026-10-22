import { describe, expect, it } from 'vitest'
import type { Action, TenantScope } from '../shared/domain/models'
import { normalizeSyntheticRecords } from '../server/normalization/synthetic'
import { createNorthstarRawDataset } from '../server/synthetic/fixtures'
import { SyntheticDemoService, matchCrossSourceEntities, rankSyntheticOpportunities } from '../server/synthetic/service'

const scope: TenantScope = { organizationId: 'org_test_northstar', workspaceId: 'ws_test_northstar' }
const otherScope: TenantScope = { organizationId: 'org_other', workspaceId: 'ws_other' }

describe('Northstar synthetic multi-source workspace', () => {
  it('matches shared entities across provider payloads after normalization', () => {
    const raw = createNorthstarRawDataset(scope).records
    const normalized = normalizeSyntheticRecords(scope, raw, '2026-10-21T17:00:00.000Z')
    const matches = matchCrossSourceEntities(normalized)
    const acme = matches.get('CUST-1042') ?? []
    expect(new Set(acme.map((record) => record.provenance.provider))).toEqual(new Set(['quickbooks', 'hubspot', 'salesforce', 'shopify', 'gmail', 'outlook', 'slack', 'microsoft_365']))
    expect(acme.every((record) => record.organizationId === scope.organizationId && record.workspaceId === scope.workspaceId)).toBe(true)
  })

  it('retains evidence provenance and cross-source diagnosis relationships', () => {
    const service = new SyntheticDemoService()
    const overview = service.overview(scope)
    const salesIssue = overview.issues.find((issue) => issue.id === 'issue_sales_conversion_decline')!
    const salesEvidence = overview.evidence.filter((item) => salesIssue.evidenceIds.includes(item.id))
    expect(new Set(salesEvidence.map((item) => item.sourceSystem))).toEqual(new Set(['hubspot', 'outlook', 'microsoft_calendar', 'google_drive']))
    expect(salesEvidence.every((item) => (item.sourceRecordIds?.length ?? 0) > 0 && item.signalId)).toBe(true)
    const proposalCause = overview.rootCauses.find((cause) => cause.id === 'root_cause_slow_proposals')!
    expect(proposalCause.issueId).toBe(salesIssue.id)
    expect(proposalCause.certainty).toBe('inferred')
    expect(proposalCause.evidenceIds).toEqual(expect.arrayContaining(['evidence_lead_response', 'evidence_fragmented_proposals']))
  })

  it('ranks opportunities using impact, confidence, urgency, and effort', () => {
    const service = new SyntheticDemoService()
    const rows = service.overview(scope).opportunities
    expect(rows.length).toBeGreaterThanOrEqual(8)
    expect(rows[0].id).toBe('opportunity_proposal_intelligence')
    expect(rows.every((row, index) => index === 0 || rows[index - 1].priorityScore >= row.priorityScore)).toBe(true)
    expect(rankSyntheticOpportunities([...rows]).map((row) => row.id)).toEqual(rows.map((row) => row.id))
  })

  it('reports broad health coverage and a synthetic-only demo state', () => {
    const overview = new SyntheticDemoService().overview(scope)
    expect(overview.mode).toBe('synthetic')
    expect(overview.sources).toHaveLength(12)
    expect(overview.health.coverage?.length).toBe(8)
    expect(overview.health.coverage?.every((item) => item.percentage >= 66)).toBe(true)
    expect(overview.records.crossSourceEntityCount).toBeGreaterThan(50)
  })

  it('exposes the pilot brief, auditable agent stats, and privacy-conscious workflow events', () => {
    const service = new SyntheticDemoService()
    const overview = service.overview(scope)
    const proposal = overview.agents.find((item) => item.agent.id === 'agent_proposal_intelligence')!
    expect(overview.briefItems).toHaveLength(13)
    expect(new Set(overview.briefItems.map((item) => item.section))).toEqual(new Set(['Needs Attention', 'Changes Since Last Brief', 'Completed by Gilar', 'Opportunities', 'Watchlist']))
    expect(proposal.stats).toMatchObject({ assisted: 12, hoursSaved: 116, completedActions: 5, pendingApprovals: 1 })
    expect(proposal.stats.directionalROI).toBeCloseTo(5.2, 1)
    expect(proposal.timeline.every((event) => event.recordType && event.recordId)).toBe(true)

    const feedback = service.recordFeedback(scope, { screen: 'root_cause', entityType: 'issue', entityId: 'issue_sales_conversion_decline', helpful: false, comment: 'Need a clearer source link.' })
    const telemetry = service.recordTelemetry(scope, { event: 'evidence_viewed', screen: 'root_cause', entityType: 'evidence', entityId: 'evidence_sales_conversion' })
    expect(feedback.workspaceId).toBe(scope.workspaceId)
    expect(feedback.comment).toContain('source link')
    expect(telemetry.event).toBe('evidence_viewed')
    expect(telemetry).not.toHaveProperty('content')
  })

  it('models pilot edge states and conflicting evidence without changing the core fixture', () => {
    const service = new SyntheticDemoService()
    expect(service.setScenario(scope, 'low_confidence').edgeStates[0].label).toBe('Low-confidence diagnosis')
    expect(service.setScenario(scope, 'partial_coverage').sources.find((source) => source.provider === 'google_drive')?.status).toBe('disconnected')
    expect(service.setScenario(scope, 'failed_action').simulation.status).toBe('failed')
    expect(service.setScenario(scope, 'no_roi').simulation.roiRecord).toBeUndefined()
    const conflicting = service.setScenario(scope, 'conflicting_evidence')
    expect(conflicting.conflicts[0].title).toBe('Evidence is mixed')
    expect(conflicting.conflicts[0].confidence).toBeLessThan(.6)
    expect(service.reset(scope).scenario).toBe('baseline')
  })

  it('requires proposal approval before deployment and measures ROI only after time advances', () => {
    const service = new SyntheticDemoService()
    const action: Action = { id: 'action_test', ...scope, createdAt: '2026-10-21T17:00:00.000Z', updatedAt: '2026-10-21T17:00:00.000Z', recommendationId: 'recommendation_opportunity_proposal_intelligence', status: 'awaiting_approval', targetSystem: 'internal', operation: 'deploy_synthetic_proposal_intelligence', requestedAt: '2026-10-21T17:00:00.000Z', auditEventIds: [] }
    expect(service.propose(scope, action).status).toBe('proposed')
    expect(service.approve(scope, { ...action, status: 'approved' }).status).toBe('approved')
    const running = service.deploy(scope, { ...action, status: 'running' })
    expect(running.status).toBe('running')
    expect(service.overview(scope).roiRecords).toHaveLength(0)
    expect(service.advance(scope, 15).status).toBe('running')
    const completed = service.advance(scope, 15)
    expect(completed.status).toBe('completed')
    expect(completed.outcome?.timeSavedHours).toBe(116)
    expect(completed.roiRecord?.annualizedImpact).toBe(41870)
    expect(service.overview(scope).roiRecords).toHaveLength(1)
  })

  it('isolates tenants and resets only the selected synthetic workspace', () => {
    const service = new SyntheticDemoService()
    const action: Action = { id: 'action_other', ...scope, createdAt: '2026-10-21T17:00:00.000Z', updatedAt: '2026-10-21T17:00:00.000Z', status: 'approved', targetSystem: 'internal', operation: 'test', requestedAt: '2026-10-21T17:00:00.000Z', auditEventIds: [] }
    service.deploy(scope, action)
    service.advance(scope, 30)
    expect(service.overview(scope).simulation.status).toBe('completed')
    expect(service.overview(otherScope).simulation.status).toBe('baseline')
    service.reset(scope)
    expect(service.overview(scope).simulation.status).toBe('baseline')
    expect(service.overview(otherScope).simulation.status).toBe('baseline')
    expect(service.overview(otherScope).records.total).toBeGreaterThan(1000)
  })
})

