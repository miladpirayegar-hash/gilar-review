import { describe, expect, it } from 'vitest'
import { calculateHealthScore, calculateROI, buildSalesConversionDiagnosis, detectSignals, scoreOpportunity } from '../server/services/bi'
import { createDemoApplicationServices } from '../server/services/application'
import { createDemoDiagnosis, createDemoSignals, demoMetrics, demoObservations, demoScope, demoUser } from '../server/demo/fixtures'
import { hasPermission } from '../shared/permissions'
import { demoMembership } from '../server/demo/fixtures'
import { TenantAccessError } from '../server/repositories/interfaces'
import { createDemoNormalizedRecords } from '../server/normalization'

describe('deterministic business intelligence pipeline', () => {
  it('detects a meaningful conversion decline and keeps source references', () => {
    const signals = createDemoSignals()
    const conversion = signals.find((signal) => signal.id === 'signal_conversion_decline')
    expect(conversion?.direction).toBe('down')
    expect(conversion?.severity).toBe('high')
    expect(conversion?.observationIds).toEqual(['metric_conversion_current', 'metric_conversion_baseline'])
  })

  it('does not emit a signal below the configured threshold', () => {
    const metric = demoMetrics.find((item) => item.key === 'conversion_decline')!
    const signals = detectSignals(demoScope, [{ metric, currentValue: 0.097, baselineValue: 0.1, observedAt: '2026-10-21T08:00:00.000Z', observationIds: [] }], '2026-10-21T08:00:00.000Z')
    expect(signals).toHaveLength(0)
  })

  it('builds a traceable issue to root cause and evidence chain', () => {
    const diagnosis = createDemoDiagnosis()
    expect(diagnosis.issue.rootCauseIds).toHaveLength(3)
    expect(diagnosis.rootCauses.at(-1)?.isPrimary).toBe(true)
    expect(diagnosis.issue.evidenceIds).toContain('evidence_response_time')
    expect(diagnosis.evidence.every((item) => item.signalId === 'signal_conversion_decline')).toBe(true)
  })

  it('uses explicit opportunity and ROI formulas', () => {
    expect(scoreOpportunity({ financialImpact: 10000, confidence: 0.8, urgency: 0.5, implementationDifficulty: 2 })).toBe(2000)
    expect(calculateROI(12000, 3000)).toBe(4)
    expect(calculateROI(12000, 0)).toBe(999)
  })

  it('calculates a weighted health score with a directional trend', () => {
    const health = calculateHealthScore([{ key: 'sales', label: 'Sales', score: 60, weight: 0.6, contributingSignalIds: ['signal_conversion_decline'] }, { key: 'finance', label: 'Finance', score: 90, weight: 0.4, contributingSignalIds: [] }], 80)
    expect(health.overallScore).toBe(72)
    expect(health.grade).toBe('B')
    expect(health.trend).toBe('down')
  })
})

describe('tenant-safe application services', () => {
  it('rejects records outside the active workspace scope', async () => {
    const services = createDemoApplicationServices()
    await expect(services.opportunityService.get({ organizationId: 'other-org', workspaceId: 'other-workspace' }, 'opportunity_invoice_follow_up')).rejects.toBeInstanceOf(TenantAccessError)
  })

  it('returns only current-scope data and maintains normalized observation ownership', async () => {
    const services = createDemoApplicationServices()
    const observations = await services.metricService.listObservations(demoScope)
    expect(observations).toHaveLength(demoObservations.length)
    expect(observations.every((item) => item.organizationId === demoScope.organizationId && item.workspaceId === demoScope.workspaceId)).toBe(true)
  })

  it('centralizes role permissions for approvals and integrations', () => {
    expect(hasPermission(demoMembership, 'approve_actions')).toBe(true)
    expect(hasPermission({ ...demoMembership, role: 'Viewer' }, 'approve_actions')).toBe(false)
    expect(hasPermission({ ...demoMembership, role: 'Manager' }, 'view_opportunities')).toBe(true)
  })

  it('normalizes seeded provider records into tenant-owned contracts', () => {
    const records = createDemoNormalizedRecords()
    expect(records.invoices[0].id).toBe('quickbooks:invoice:invoice_1042')
    expect(records.invoices[0].status).toBe('overdue')
    expect(records.leads[0].organizationId).toBe(demoScope.organizationId)
  })

  it('keeps action approval explicit and emits immutable audit records', async () => {
    const services = createDemoApplicationServices()
    const session = { user: demoUser, membership: demoMembership }
    const action = await services.actionService.propose(demoScope, session, { recommendationId: 'recommendation_proposal_intelligence', targetSystem: 'gmail', operation: 'draft_follow_up' })
    expect(action.status).toBe('awaiting_approval')
    expect((await services.auditService.list(demoScope))).toHaveLength(1)
    const approved = await services.actionService.approve(demoScope, session, action.id)
    expect(approved.status).toBe('approved')
    expect((await services.auditService.list(demoScope))).toHaveLength(2)
  })
})
