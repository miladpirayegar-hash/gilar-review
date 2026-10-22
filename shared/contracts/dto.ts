export interface DashboardDTO {
  workspace: { id: string; name: string; organizationId: string }
  metrics: Array<{ key: string; label: string; value: string; change?: string; trend?: 'up' | 'down' | 'flat' }>
  attention: Array<{ issueId: string; title: string; detail: string; severity: 'low' | 'medium' | 'high' | 'critical'; deepLink: string }>
}

export interface BusinessHealthScoreDTO {
  overallScore: number
  grade: string
  trend: 'up' | 'down' | 'flat'
  dimensions: Array<{ key: string; label: string; score: number; weight: number; contributingSignalIds: string[] }>
  coverage?: Array<{ dimension: string; percentage: number; status: 'available' | 'partial' | 'insufficient'; confidence: number; trend?: 'up' | 'down' | 'flat'; evidenceCount?: number }>
}

export interface OpportunityDTO {
  id: string
  title: string
  category: string
  summary: string
  estimatedAnnualValue: number
  estimatedSavings: number
  estimatedRevenueUpside: number
  roi: number
  urgency: number
  confidence: number
  implementationDifficulty: number
  priorityScore: number
  status: string
  issueId?: string
  evidenceIds?: string[]
  recommendedAction?: string
  sourceSystem?: string
  analysisPeriod?: { start: string; end: string }
  impactOrigin?: string
}
