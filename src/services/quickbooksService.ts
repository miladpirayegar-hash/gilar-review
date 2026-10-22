export interface QuickBooksStage {
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  importedRecords?: number
  message?: string
}

export interface QuickBooksStatus {
  mode: 'demo' | 'synthetic' | 'sandbox' | 'production'
  configured: boolean
  connected: boolean
  status: string
  syncStatus: string
  realmId?: string
  companyName?: string
  lastSyncAt?: string
  lastSuccessfulSyncAt?: string
  recordsSynchronized: number
  stages: QuickBooksStage[]
  health?: { healthy: boolean; message?: string }
  lastError?: string
}

export interface BusinessHealthResult {
  overallScore: number
  grade: string
  trend: 'up' | 'down' | 'flat'
  dimensions: Array<{ key: string; label: string; score: number; weight: number; contributingSignalIds: string[] }>
  coverage?: Array<{ dimension: string; percentage: number; status: 'available' | 'partial' | 'insufficient'; confidence: number }>
}

export interface QuickBooksOpportunity {
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

export interface QuickBooksIssue {
  issue: { id: string; title: string; description: string; severity: string; confidence: number; evidenceIds: string[] }
  rootCauses: Array<{ id: string; title: string; explanation: string; confidence: number; certainty?: 'observed' | 'inferred' | 'unknown' }>
  evidence: Array<{ id: string; description: string; observedValue: number | string; comparisonValue?: number | string; sourceSystem: string }>
  opportunityId?: string
  recommendedAction?: string
}

export interface QuickBooksRecommendation {
  id: string
  opportunityId: string
  rationale: string
  evidenceIds: string[]
  expectedBenefit: string
  expectedROI: number
  estimatedTimeSavedHours: number
  implementationComplexity: 'low' | 'medium' | 'high'
  confidence: number
  risks: string[]
  approvalRequired: boolean
  status: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  if (!response.ok) throw new Error(`QuickBooks request failed with status ${response.status}.`)
  const body = await response.json() as { data: T }
  return body.data
}

const liveModeEnabled = import.meta.env.VITE_GILAR_MODE === 'sandbox' || import.meta.env.VITE_GILAR_MODE === 'production'

export const quickBooksApi = {
  async status(): Promise<QuickBooksStatus | undefined> {
    if (!liveModeEnabled) return undefined
    try { return await request<QuickBooksStatus>('/api/integrations/quickbooks/status') } catch { return undefined }
  },
  async connect(): Promise<string | undefined> {
    if (!liveModeEnabled) return undefined
    const result = await request<{ authorizationUrl: string }>('/api/integrations/quickbooks/connect')
    return result.authorizationUrl
  },
  async sync(mode: 'initial' | 'manual' | 'incremental' = 'initial'): Promise<QuickBooksStatus | undefined> {
    if (!liveModeEnabled) return undefined
    try { await request('/api/integrations/quickbooks/sync', { method: 'POST', body: JSON.stringify({ mode }) }); return await this.status() } catch { return undefined }
  },
  async businessHealth(): Promise<BusinessHealthResult | undefined> {
    if (!liveModeEnabled) return undefined
    try { return await request<BusinessHealthResult>('/api/business-health') } catch { return undefined }
  },
  async opportunities(): Promise<QuickBooksOpportunity[] | undefined> {
    if (!liveModeEnabled) return undefined
    try { return await request<QuickBooksOpportunity[]>('/api/opportunities') } catch { return undefined }
  },
  async issue(id: string): Promise<QuickBooksIssue | undefined> {
    if (!liveModeEnabled) return undefined
    try { return await request<QuickBooksIssue>(`/api/issues/${encodeURIComponent(id)}`) } catch { return undefined }
  },
  async recommendation(id: string): Promise<QuickBooksRecommendation | undefined> {
    if (!liveModeEnabled) return undefined
    try { return await request<QuickBooksRecommendation>(`/api/recommendations/${encodeURIComponent(id)}`) } catch { return undefined }
  },
  async disconnect(): Promise<boolean> {
    if (!liveModeEnabled) return false
    try { await request('/api/integrations/quickbooks', { method: 'DELETE' }); return true } catch { return false }
  },
  isLiveMode: liveModeEnabled,
}
