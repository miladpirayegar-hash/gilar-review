import { activities, agents, company, healthItems, integrations, metrics, opportunities } from '../data/demoData'
import type { Agent, Integration, Opportunity } from '../types'

export interface DemoWorkspace {
  id: string
  organizationId: string
  name: string
  owner: string
  initials: string
  date: string
}

export interface HealthDimension {
  key: string
  label: string
  score: number
  weight: number
  color: string
  contributingSignalIds: string[]
}

export interface HealthScoreView {
  overallScore: number
  grade: string
  trend: 'up' | 'down' | 'flat'
  dimensions: HealthDimension[]
}

export interface DemoRepository<T extends { id: string }> {
  list(): T[]
  getById(id: string): T | undefined
}

function createRepository<T extends { id: string }>(records: T[]): DemoRepository<T> {
  return {
    list: () => [...records],
    getById: (id) => records.find((record) => record.id === id),
  }
}

const workspace: DemoWorkspace = {
  id: 'ws_northstar_demo',
  organizationId: 'org_northstar_demo',
  name: company.name,
  owner: company.owner,
  initials: company.initials,
  date: company.date,
}

const opportunityRepository = createRepository(opportunities)
const agentRepository = createRepository(agents)
const integrationRepository = createRepository(integrations)

export const organizationService = {
  getCurrent: () => ({ id: workspace.organizationId, name: workspace.name, slug: 'northstar-studio' }),
}

export const workspaceService = {
  getCurrent: (): DemoWorkspace => ({ ...workspace }),
}

export const dashboardService = {
  metrics: () => [...metrics],
  attention: () => [
    { issueId: 'issue_invoice_follow_up', title: '11 customers haven’t received follow-up', detail: 'Potential revenue at risk: $42,000', severity: 'high' as const, deepLink: '/app/opportunities/root-cause' },
    { issueId: 'issue_inventory_shortage', title: 'Inventory down for Product X in 12 days', detail: 'Current stock will last 12 days', severity: 'medium' as const, deepLink: '/app/opportunities' },
    { issueId: 'issue_proposal_turnaround', title: 'Proposal turnaround increased from 2.1 to 4.3 days', detail: 'Consider using Proposal Intelligence Agent', severity: 'high' as const, deepLink: '/app/opportunities/recommendation' },
  ],
}

export const opportunityService = {
  list: () => opportunityRepository.list(),
  getById: (id: string) => opportunityRepository.getById(id),
}

export const agentService = {
  list: () => agentRepository.list(),
  getById: (id: string) => agentRepository.getById(id),
}

export const integrationService = {
  list: () => integrationRepository.list(),
  getByName: (name: string) => integrationRepository.list().find((integration) => integration.name === name),
}

export const activityService = {
  list: () => [...activities],
}

export const healthScoreService = {
  getScore: (): HealthScoreView => {
    const dimensions = healthItems.map((item, index) => ({
      key: item.label.toLowerCase().replaceAll(' ', '_').replaceAll('&', 'and'),
      label: item.label,
      score: item.score,
      weight: index === 0 || index === 1 || index === 2 ? 1.2 : 1,
      color: item.color,
      contributingSignalIds: [`signal_${index + 1}`],
    }))
    const weightedTotal = dimensions.reduce((total, dimension) => total + dimension.score * dimension.weight, 0)
    const totalWeight = dimensions.reduce((total, dimension) => total + dimension.weight, 0)
    const overallScore = Math.round(weightedTotal / totalWeight)
    return { overallScore, grade: overallScore >= 85 ? 'A' : overallScore >= 75 ? 'B+' : 'B', trend: 'up', dimensions }
  },
}

export type { Agent, Integration, Opportunity }
