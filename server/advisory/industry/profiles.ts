import type { BusinessProfileDTO } from '../../../shared/contracts/metrics'

export interface IndustryProfile {
  key: string
  label: string
  kpis: string[]
  bottlenecks: string[]
  workflows: string[]
  risks: string[]
  diagnosticQuestions: string[]
  opportunityTypes: string[]
  playbooks: string[]
}

export const industryProfiles: Record<string, IndustryProfile> = {
  distribution: {
    key: 'distribution', label: 'Distribution / wholesale',
    kpis: ['revenue', 'cash_position', 'pipeline_value', 'overdue_receivables', 'inventory_days_remaining', 'sales_conversion_rate'],
    bottlenecks: ['slow proposal response', 'aging receivables', 'inventory replenishment gaps', 'manual order entry'],
    workflows: ['quote to order', 'order to cash', 'inventory replenishment', 'supplier purchasing'],
    risks: ['stockout exposure', 'customer concentration', 'late collections', 'margin compression'],
    diagnosticQuestions: ['Which proposals are waiting on internal context?', 'Which overdue accounts lack an accountable owner?', 'Which SKUs have less than the target cover window?'],
    opportunityTypes: ['proposal workflow', 'receivables follow-up', 'inventory monitoring', 'purchase order automation'],
    playbooks: ['draft-only proposal assistance', 'approval-based collections queue', 'cover threshold alerts'],
  },
  'professional-services': { key: 'professional-services', label: 'Professional services', kpis: ['pipeline_value', 'sales_conversion_rate', 'lead_response_time'], bottlenecks: ['utilization leakage', 'slow proposals', 'billing delays'], workflows: ['lead to proposal', 'project delivery', 'time to invoice'], risks: ['margin erosion', 'pipeline volatility'], diagnosticQuestions: ['Where is billable capacity being lost?'], opportunityTypes: ['proposal workflow', 'billing workflow'], playbooks: ['proposal draft assistance'] },
  retail: { key: 'retail', label: 'Retail', kpis: ['revenue', 'inventory_days_remaining'], bottlenecks: ['inventory turnover', 'returns', 'conversion'], workflows: ['order to fulfillment', 'replenishment'], risks: ['stockouts', 'excess inventory'], diagnosticQuestions: ['Which products are approaching their cover threshold?'], opportunityTypes: ['inventory monitoring'], playbooks: ['replenishment alerts'] },
  ecommerce: { key: 'ecommerce', label: 'Ecommerce', kpis: ['revenue', 'inventory_days_remaining', 'sales_conversion_rate'], bottlenecks: ['checkout conversion', 'returns', 'fulfillment'], workflows: ['visit to order', 'order to delivery'], risks: ['cart abandonment', 'stockouts'], diagnosticQuestions: ['Which funnel stage is changing fastest?'], opportunityTypes: ['conversion monitoring'], playbooks: ['funnel diagnostics'] },
  manufacturing: { key: 'manufacturing', label: 'Manufacturing', kpis: ['revenue', 'inventory_days_remaining'], bottlenecks: ['production scheduling', 'supplier delays'], workflows: ['plan to produce', 'purchase to receive'], risks: ['line downtime', 'material shortages'], diagnosticQuestions: ['Which input is constraining production?'], opportunityTypes: ['supplier monitoring'], playbooks: ['exception queues'] },
  construction: { key: 'construction', label: 'Construction', kpis: ['pipeline_value', 'overdue_receivables'], bottlenecks: ['change orders', 'billing cycle'], workflows: ['bid to contract', 'work to bill'], risks: ['cash timing', 'scope creep'], diagnosticQuestions: ['Which projects have unresolved commercial changes?'], opportunityTypes: ['billing workflow'], playbooks: ['approval queues'] },
  healthcare: { key: 'healthcare', label: 'Healthcare services', kpis: ['revenue', 'cash_position'], bottlenecks: ['scheduling', 'claims follow-up'], workflows: ['appointment to claim', 'claim to payment'], risks: ['denials', 'capacity'], diagnosticQuestions: ['Where are claims or appointments waiting?'], opportunityTypes: ['follow-up workflow'], playbooks: ['exception monitoring'] },
  hospitality: { key: 'hospitality', label: 'Restaurants / hospitality', kpis: ['revenue', 'cash_position'], bottlenecks: ['labor planning', 'inventory waste'], workflows: ['booking to service', 'purchase to kitchen'], risks: ['labor variance', 'waste'], diagnosticQuestions: ['Which operating cost is moving faster than sales?'], opportunityTypes: ['cost monitoring'], playbooks: ['variance review'] },
  technology: { key: 'technology', label: 'Technology / SaaS', kpis: ['revenue', 'pipeline_value', 'sales_conversion_rate'], bottlenecks: ['pipeline velocity', 'renewals'], workflows: ['lead to close', 'adoption to renewal'], risks: ['churn', 'concentration'], diagnosticQuestions: ['Which accounts or stages are slowing?'], opportunityTypes: ['pipeline monitoring'], playbooks: ['renewal queues'] },
  'real-estate': { key: 'real-estate', label: 'Real estate', kpis: ['pipeline_value', 'cash_position'], bottlenecks: ['lead response', 'document processing'], workflows: ['lead to showing', 'offer to close'], risks: ['cycle time', 'financing delays'], diagnosticQuestions: ['Which transaction is waiting on a document or decision?'], opportunityTypes: ['document workflow'], playbooks: ['transaction exception queues'] },
  logistics: { key: 'logistics', label: 'Logistics', kpis: ['revenue', 'overdue_receivables'], bottlenecks: ['shipment exceptions', 'billing delays'], workflows: ['order to delivery', 'delivery to invoice'], risks: ['late delivery', 'margin leakage'], diagnosticQuestions: ['Which shipment exceptions are recurring?'], opportunityTypes: ['shipment monitoring'], playbooks: ['exception routing'] },
}

export function industryKey(industry?: string): string {
  const normalized = (industry ?? '').toLowerCase()
  if (normalized.includes('distribution') || normalized.includes('wholesale')) return 'distribution'
  if (normalized.includes('professional')) return 'professional-services'
  if (normalized.includes('ecommerce') || normalized.includes('e-commerce')) return 'ecommerce'
  if (normalized.includes('manufactur')) return 'manufacturing'
  if (normalized.includes('construction')) return 'construction'
  if (normalized.includes('health')) return 'healthcare'
  if (normalized.includes('restaurant') || normalized.includes('hospital')) return 'hospitality'
  if (normalized.includes('saas') || normalized.includes('technology')) return 'technology'
  if (normalized.includes('real estate')) return 'real-estate'
  if (normalized.includes('logistic')) return 'logistics'
  if (normalized.includes('retail')) return 'retail'
  return 'distribution'
}

export function profileFor(profile: BusinessProfileDTO): IndustryProfile {
  return industryProfiles[industryKey(profile.industry)] ?? industryProfiles.distribution
}
