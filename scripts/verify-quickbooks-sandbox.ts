import 'dotenv/config'

type ApiEnvelope<T> = { data: T }

const apiOrigin = process.env.GILAR_API_ORIGIN ?? `http://localhost:${process.env.PORT ?? '8787'}`
const requiredEnvironment = ['INTUIT_CLIENT_ID', 'INTUIT_CLIENT_SECRET', 'INTUIT_REDIRECT_URI', 'INTUIT_ENVIRONMENT', 'GILAR_MODE', 'VITE_GILAR_MODE'] as const

function assertSandboxEnvironment(): void {
  const missing = requiredEnvironment.filter((name) => !process.env[name])
  if (missing.length > 0) throw new Error(`Sandbox verification is not configured. Set ${missing.join(', ')} in .env. Use INTUIT_ENVIRONMENT=sandbox, GILAR_MODE=sandbox, and VITE_GILAR_MODE=sandbox.`)
  if (process.env.INTUIT_ENVIRONMENT !== 'sandbox' || process.env.GILAR_MODE !== 'sandbox' || process.env.VITE_GILAR_MODE !== 'sandbox') throw new Error('Sandbox verification requires INTUIT_ENVIRONMENT=sandbox, GILAR_MODE=sandbox, and VITE_GILAR_MODE=sandbox.')
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiOrigin}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  const body = await response.json() as ApiEnvelope<T> & { error?: { message?: string } }
  if (!response.ok) throw new Error(body.error?.message ?? `API request failed with status ${response.status}.`)
  return body.data
}

function countByOrigin(metrics: Array<{ origin?: string }>): string {
  const counts = new Map<string, number>()
  metrics.forEach((metric) => counts.set(metric.origin ?? 'unknown', (counts.get(metric.origin ?? 'unknown') ?? 0) + 1))
  return [...counts.entries()].map(([origin, count]) => `${origin}:${count}`).join(', ') || 'none'
}

async function run(): Promise<void> {
  assertSandboxEnvironment()
  await request<{ status: string }>('/health')
  const initial = await request<{ connected: boolean; configured: boolean; syncStatus: string }>('/api/integrations/quickbooks/status')
  console.log(`[qbo] configuration ready; API configured=${initial.configured}`)
  if (!initial.connected) throw new Error('Complete QuickBooks OAuth in the Gilar Connect Business flow, then run this verifier again. No credentials or tokens are printed by this command.')

  const firstAnalysis = await request<{ metrics: Array<{ key?: string; origin?: string }>; signals: unknown[]; evidence: Array<{ sourceSystem: string; sourceRecordIds?: string[] }>; issues: unknown[]; rootCauses: Array<{ certainty?: string }>; opportunities: Array<{ id: string; issueId?: string; sourceSystem?: string }> }>('/api/integrations/quickbooks/sync', { method: 'POST', body: JSON.stringify({ mode: 'manual' }) })
  const firstStatus = await request<{ connected: boolean; syncStatus: string; status: string; recordsSynchronized: number; stages: Array<{ name: string; status: string; importedRecords?: number }> }>('/api/integrations/quickbooks/status')
  console.log(`[qbo] first sync status=${firstStatus.status}/${firstStatus.syncStatus}; records=${firstStatus.recordsSynchronized}; signals=${firstAnalysis.signals.length}; evidence=${firstAnalysis.evidence.length}; opportunities=${firstAnalysis.opportunities.length}`)
  console.log(`[qbo] metric origins=${countByOrigin(firstAnalysis.metrics)}; completed stages=${firstStatus.stages.filter((stage) => stage.status === 'completed').length}/${firstStatus.stages.length}`)
  const calculatedRevenue = firstAnalysis.metrics.some((metric) => metric.key === 'revenue' && metric.origin === 'gilar_calculated')
  const reportedRevenue = firstAnalysis.metrics.some((metric) => metric.key === 'reported_revenue' && metric.origin === 'quickbooks_reported')
  const calculatedExpenses = firstAnalysis.metrics.some((metric) => metric.key === 'expenses' && metric.origin === 'gilar_calculated')
  const reportedExpenses = firstAnalysis.metrics.some((metric) => metric.key === 'reported_expenses' && metric.origin === 'quickbooks_reported')
  console.log(`[qbo] Profit & Loss cross-check revenue=${calculatedRevenue && reportedRevenue ? 'available' : 'not available'}; expenses=${calculatedExpenses && reportedExpenses ? 'available' : 'not available'}`)

  const secondAnalysis = await request<{ opportunities: unknown[] }>('/api/integrations/quickbooks/sync', { method: 'POST', body: JSON.stringify({ mode: 'manual' }) })
  const secondStatus = await request<{ recordsSynchronized: number; status: string; syncStatus: string }>('/api/integrations/quickbooks/status')
  console.log(`[qbo] repeat sync status=${secondStatus.status}/${secondStatus.syncStatus}; records=${secondStatus.recordsSynchronized}; opportunities=${secondAnalysis.opportunities.length}; duplicate check=${secondStatus.recordsSynchronized === firstStatus.recordsSynchronized ? 'passed' : 'review'}`)

  const health = await request<{ overallScore: number; dimensions: unknown[]; coverage?: Array<{ dimension: string; status: string; confidence: number }> }>('/api/business-health')
  const opportunities = await request<Array<{ id: string; issueId?: string; sourceSystem?: string; evidenceIds?: string[] }>>('/api/opportunities')
  const firstOpportunity = opportunities[0]
  if (!firstOpportunity) throw new Error('The sandbox sync completed without an opportunity to trace.')
  const issueId = firstOpportunity.issueId ?? firstOpportunity.id.replace('opportunity_', 'issue_')
  const diagnosis = await request<{ issue: { id: string }; rootCauses: Array<{ certainty?: string }>; evidence: Array<{ sourceSystem: string; sourceRecordId?: string }> }>(`/api/issues/${encodeURIComponent(issueId)}`)
  const recommendation = await request<{ opportunityId: string; evidenceIds: string[]; expectedBenefit: string }>(`/api/recommendations/recommendation_${encodeURIComponent(firstOpportunity.id)}`)
  const evidenceTraceable = firstAnalysis.evidence.every((item) => item.sourceSystem === 'quickbooks' && (item.sourceRecordIds?.length ?? 0) > 0)
  const rootCauseHonest = diagnosis.rootCauses.length === 0 || diagnosis.rootCauses.every((rootCause) => rootCause.certainty === 'unknown')
  const recommendationTraceable = recommendation.opportunityId === firstOpportunity.id && recommendation.evidenceIds.length > 0
  const insufficient = health.coverage?.filter((item) => item.status === 'insufficient').map((item) => item.dimension).join(', ') || 'none'
  console.log(`[qbo] Business MRI score=${health.overallScore}; dimensions=${health.dimensions.length}; insufficient=${insufficient}`)
  console.log(`[qbo] traceability signal→evidence→issue→root-cause→opportunity→recommendation: ${evidenceTraceable && rootCauseHonest && recommendationTraceable ? 'passed' : 'review'}`)
  if (!evidenceTraceable || !rootCauseHonest || !recommendationTraceable) throw new Error('The sandbox result did not satisfy evidence traceability or root-cause honesty checks.')
}

run().catch((error) => {
  console.error(`[qbo] verification failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  process.exitCode = 1
})
