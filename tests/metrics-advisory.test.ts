import { describe, expect, it } from 'vitest'
import { createAdvisoryOutput } from '../server/advisory/service'
import { buildMetricRegistry } from '../server/services/metricRegistry'
import { SyntheticDemoService } from '../server/synthetic/service'

describe('metric registry and advisory contracts', () => {
  it('builds current, previous, change, provenance, and series from observations', () => {
    const registry = buildMetricRegistry({
      asOf: '2026-10-22T00:00:00.000Z',
      metrics: [{ id: 'metric_revenue', organizationId: 'org', workspaceId: 'workspace', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', key: 'revenue', name: 'Revenue', category: 'financial', unit: 'currency', status: 'active' }],
      observations: [
        { id: 'observation_old', organizationId: 'org', workspaceId: 'workspace', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', metricId: 'metric_revenue', value: 100, observedAt: '2026-10-10T00:00:00.000Z', periodStart: '2026-10-01T00:00:00.000Z', periodEnd: '2026-10-10T00:00:00.000Z', sourceRecordIds: ['invoice_old'] },
        { id: 'observation_new', organizationId: 'org', workspaceId: 'workspace', createdAt: '2026-10-22T00:00:00.000Z', updatedAt: '2026-10-22T00:00:00.000Z', metricId: 'metric_revenue', value: 125, observedAt: '2026-10-22T00:00:00.000Z', periodStart: '2026-10-11T00:00:00.000Z', periodEnd: '2026-10-22T00:00:00.000Z', sourceRecordIds: ['invoice_new'] },
      ],
      sourceSystems: { revenue: ['quickbooks'] },
      metadata: { revenue: { calculationMethod: 'Sum of posted invoice totals', confidence: .92, coverage: .8, evidenceState: 'calculated' } },
      series: { revenue: [{ timestamp: '2026-10-10T00:00:00.000Z', value: 100 }, { timestamp: '2026-10-22T00:00:00.000Z', value: 125 }] },
    })
    expect(registry.metrics[0]).toMatchObject({ key: 'revenue', currentValue: 125, previousValue: 100, direction: 'up', percentageChange: 25, sourceSystems: ['quickbooks'], calculationMethod: 'Sum of posted invoice totals', evidenceState: 'calculated', availability: 'available' })
    expect(registry.metrics[0].series).toHaveLength(2)
  })

  it('grounds advisory actions in opportunity evidence and industry context', () => {
    const overview = new SyntheticDemoService().overview({ organizationId: 'org_test', workspaceId: 'workspace_test' })
    const output = createAdvisoryOutput(overview.advisoryContext)
    expect(output.recommendedActions.length).toBeGreaterThan(0)
    expect(output.recommendedActions[0].evidenceIds.length).toBeGreaterThan(0)
    expect(output.recommendedActions[0].expectedImpact).toBe(overview.opportunities[0].estimatedAnnualValue)
    expect(output.recommendedActions[0].industryRelevance).toMatch(/KPI|workflow/)
    expect(output.recommendedActions[0].assumptions.length).toBeGreaterThan(0)
  })

  it('exposes the synthetic business profile and registry on every overview', () => {
    const overview = new SyntheticDemoService().overview({ organizationId: 'org_test', workspaceId: 'workspace_test' })
    expect(overview.businessProfile).toMatchObject({ companyName: 'Northstar Distribution Co.', industry: 'B2B distribution', source: 'synthetic_fixture' })
    expect(overview.metricRegistry.metrics.some((metric) => metric.key === 'revenue')).toBe(true)
    expect(overview.advisoryContext.businessProfile.companyName).toBe(overview.businessProfile.companyName)
  })
})
