export type Severity = 'High' | 'Medium' | 'Low'
export type Trend = 'up' | 'down' | 'flat'

export interface Metric {
  label: string
  value: string
  change?: string
  trend?: Trend
  detail?: string
}

export interface Opportunity {
  id: string
  title: string
  description: string
  impact: string
  annualValue: number
  category: string
  tag: 'High ROI' | 'Quick Win' | 'Strategic'
  confidence: number
  effort: 'Low' | 'Medium' | 'High'
  evidence: string
  accent: string
}

export interface Integration {
  id: string
  name: string
  category: string
  status: 'Connected' | 'Ready' | 'Needs attention'
  permission: 'Observe' | 'Recommend' | 'Act'
  icon: string
}

export interface Agent {
  id: string
  name: string
  description: string
  impact: string
  status: 'Active' | 'Recommended' | 'Paused'
  icon: string
  color: string
  metrics: { label: string; value: string }[]
}
