import type { BusinessMetric, Evidence, Issue, Opportunity, Recommendation, RootCause, Signal } from '../domain/models'

export type MetricDirection = 'up' | 'down' | 'flat'
export type MetricEvidenceState = 'observed' | 'calculated' | 'estimated' | 'projected'
export type MetricAvailability = 'available' | 'partial' | 'insufficient'
export type MetricPeriod = 'daily' | 'weekly' | 'monthly'

export interface MetricSeriesPoint {
  timestamp: string
  value: number
  label?: string
}

export interface MetricViewDTO {
  key: string
  label: string
  unit: BusinessMetric['unit'] | 'currency' | 'percentage' | 'hours' | 'minutes'
  currentValue?: number
  previousValue?: number
  direction: MetricDirection
  percentageChange?: number
  period: string
  sourceSystems: string[]
  calculationMethod: string
  confidence: number
  coverage: number
  timestamp: string
  freshness: string
  evidenceState: MetricEvidenceState
  availability: MetricAvailability
  series: MetricSeriesPoint[]
}

export interface MetricRegistryDTO {
  asOf: string
  metrics: MetricViewDTO[]
}

export interface BusinessProfileDTO {
  companyName: string
  industry: string
  subIndustry?: string
  businessModel: 'B2B' | 'B2C' | 'B2B2C' | 'unknown'
  employeeCount?: number
  annualRevenueRange?: string
  geography?: string
  customerType?: 'B2B' | 'B2C' | 'B2B2C' | 'unknown'
  salesCycle?: string
  primaryProductsOrServices?: string[]
  majorOperatingFunctions?: string[]
  goals?: string[]
  currentChallenges?: string[]
  seasonality?: string
  strategicPriorities?: string[]
  source: 'onboarding' | 'synthetic_fixture' | 'workspace'
  updatedAt: string
}

export interface AdvisoryContextDTO {
  workspace: { name: string; industry: string }
  businessProfile: BusinessProfileDTO
  metrics: MetricViewDTO[]
  signals: Signal[]
  evidence: Evidence[]
  issues: Issue[]
  rootCauses: RootCause[]
  opportunities: Opportunity[]
  recommendations: Recommendation[]
  constraints: string[]
  permissions: string[]
}

export interface AdvisoryOutputDTO {
  executiveSummary: string
  risks: string[]
  opportunities: string[]
  recommendedActions: Array<{
    opportunityId: string
    title: string
    reasoning: string
    evidenceIds: string[]
    confidence: number
    expectedImpact: number
    implementationDifficulty: number
    industryRelevance: string
    assumptions: string[]
    unansweredQuestions: string[]
  }>
}
