import type { AdvisoryContextDTO, AdvisoryOutputDTO, BusinessProfileDTO } from '../../shared/contracts/metrics'
import { profileFor } from './industry/profiles'

export function createAdvisoryOutput(context: AdvisoryContextDTO): AdvisoryOutputDTO {
  const industry = profileFor(context.businessProfile)
  const ranked = [...context.opportunities].sort((left, right) => right.priorityScore - left.priorityScore || right.confidence - left.confidence)
  const top = ranked.slice(0, 5).map((opportunity) => ({
    opportunityId: opportunity.id,
    title: opportunity.title,
    reasoning: `${opportunity.summary} This is relevant to ${industry.label.toLowerCase()} because it maps to ${industry.opportunityTypes[0] ?? 'a tracked workflow'}.`,
    evidenceIds: opportunity.evidenceIds,
    confidence: opportunity.confidence,
    expectedImpact: opportunity.estimatedAnnualValue,
    implementationDifficulty: opportunity.implementationDifficulty,
    industryRelevance: industry.kpis.some((key) => opportunity.title.toLowerCase().includes(key.replaceAll('_', ' '))) ? 'Direct KPI match' : 'Relevant workflow pattern',
    assumptions: ['Impact is an estimate until an approved measurement window completes.', 'Recommendations remain bounded by the listed permissions.'],
    unansweredQuestions: industry.diagnosticQuestions.slice(0, 2),
  }))
  const openRisks = context.issues.filter((issue) => issue.status === 'open').slice(0, 3).map((issue) => issue.title)
  return {
    executiveSummary: `${context.businessProfile.companyName} has ${context.metrics.filter((metric) => metric.availability === 'available').length} available metrics across ${new Set(context.metrics.flatMap((metric) => metric.sourceSystems)).size} connected source systems. ${top[0]?.title ?? 'No prioritized opportunity is available yet.'} is the strongest current starting point.`,
    risks: openRisks.length ? openRisks : ['No material risk is available from the current data.'],
    opportunities: top.map((item) => item.title),
    recommendedActions: top,
  }
}

export function createAdvisoryContext(input: Omit<AdvisoryContextDTO, 'constraints' | 'permissions'> & Partial<Pick<AdvisoryContextDTO, 'constraints' | 'permissions'>>): AdvisoryContextDTO {
  return { ...input, constraints: input.constraints ?? ['No production writes without explicit approval.', 'Estimates are not realized revenue.', 'Unsupported facts must remain suppressed.'], permissions: input.permissions ?? ['observe', 'recommend'] }
}
