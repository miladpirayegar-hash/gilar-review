import { Agent, Integration, Opportunity } from '../types'

export const company = {
  name: 'Northstar Studio',
  owner: 'Milad',
  initials: 'MP',
  date: 'October 21, 2026',
}

export const metrics = [
  { label: 'Revenue', value: '$842K', change: '+6.4%', trend: 'up' as const, detail: 'from last month' },
  { label: 'Cash position', value: '$124K', change: 'Stable', trend: 'flat' as const, detail: 'healthy runway' },
  { label: 'Pipeline', value: '$310K', change: '-11%', trend: 'down' as const, detail: 'needs attention' },
  { label: 'Overdue invoices', value: '$18,420', change: '5 accounts', trend: 'down' as const, detail: 'follow-up needed' },
]

export const opportunities: Opportunity[] = [
  { id: 'invoice', title: 'Automate invoice follow-up', description: '11 customers have not received a follow-up sequence after their invoice became overdue.', impact: 'Potential revenue at risk: $42,000', annualValue: 54000, category: 'Finance', tag: 'High ROI', confidence: 94, effort: 'Low', evidence: '11 overdue accounts have no follow-up activity in the last 14 days.', accent: 'blue' },
  { id: 'software', title: 'Reduce software costs', description: 'Three overlapping tools are under-used and can be consolidated without disrupting the team.', impact: 'Estimated annual savings: $9,600', annualValue: 9600, category: 'Operations', tag: 'Quick Win', confidence: 89, effort: 'Low', evidence: 'Seat utilization is below 35% for three recurring subscriptions.', accent: 'green' },
  { id: 'lead-response', title: 'Improve lead response time', description: 'High-intent leads wait too long for a first response when the sales team is in delivery mode.', impact: 'Estimated annual upside: $31,000', annualValue: 31000, category: 'Growth', tag: 'Strategic', confidence: 86, effort: 'Medium', evidence: 'Median first response time grew from 2.1h to 4.3h in the last quarter.', accent: 'blue' },
  { id: 'admin', title: 'Reduce administrative work', description: 'Proposal preparation and client handoffs repeat the same manual research every week.', impact: '48 hours reclaimed per month', annualValue: 19200, category: 'Productivity', tag: 'Quick Win', confidence: 91, effort: 'Low', evidence: 'The team spends 12 hours per week assembling proposal context by hand.', accent: 'yellow' },
  { id: 'inventory', title: 'Improve inventory forecasting', description: 'A seasonal demand signal is missing from the current planning cadence.', impact: 'Avoid $18,000 in stock exposure', annualValue: 18000, category: 'Operations', tag: 'Strategic', confidence: 79, effort: 'High', evidence: 'Product X stock-outs increased 22% while reorder timing stayed flat.', accent: 'red' },
]

export const integrations: Integration[] = [
  { id: 'integration_quickbooks', name: 'QuickBooks', category: 'Accounting', status: 'Connected', permission: 'Observe', icon: 'QB' },
  { id: 'integration_gmail', name: 'Gmail', category: 'Email', status: 'Connected', permission: 'Recommend', icon: 'GM' },
  { id: 'integration_google_drive', name: 'Google Drive', category: 'Files & docs', status: 'Connected', permission: 'Observe', icon: 'GD' },
  { id: 'integration_slack', name: 'Slack', category: 'Team communication', status: 'Connected', permission: 'Observe', icon: 'SL' },
  { id: 'integration_microsoft_365', name: 'Microsoft 365', category: 'Files & calendar', status: 'Ready', permission: 'Observe', icon: 'MS' },
  { id: 'integration_hubspot', name: 'HubSpot', category: 'CRM', status: 'Ready', permission: 'Recommend', icon: 'HS' },
  { id: 'integration_salesforce', name: 'Salesforce', category: 'CRM', status: 'Ready', permission: 'Observe', icon: 'SF' },
  { id: 'integration_shopify', name: 'Shopify', category: 'Commerce', status: 'Ready', permission: 'Observe', icon: 'SH' },
]

export const agents: Agent[] = [
  { id: 'proposal', name: 'Proposal Intelligence', description: 'Turns scattered context into clear, on-brand proposals in minutes.', impact: '$16,400 / year', status: 'Active', icon: 'PI', color: 'blue', metrics: [{ label: 'Proposals created', value: '24' }, { label: 'Avg. completion', value: '47 min' }, { label: 'Hours saved', value: '32' }] },
  { id: 'inbox', name: 'Inbox Operations', description: 'Routes important emails and keeps high-intent conversations moving.', impact: '12 hrs / month', status: 'Recommended', icon: 'IO', color: 'green', metrics: [{ label: 'Messages routed', value: '186' }, { label: 'SLA coverage', value: '94%' }, { label: 'Hours saved', value: '12' }] },
  { id: 'cost', name: 'Cost Intelligence', description: 'Finds duplicate spend and flags unusual financial patterns.', impact: '$9,600 / year', status: 'Recommended', icon: 'CI', color: 'teal', metrics: [{ label: 'Costs reviewed', value: '$124K' }, { label: 'Savings found', value: '$9.6K' }, { label: 'Confidence', value: '89%' }] },
  { id: 'growth', name: 'Growth Marketing', description: 'Connects campaign signals to pipeline and suggests the next best move.', impact: '$31,000 / year', status: 'Paused', icon: 'GM', color: 'blue', metrics: [{ label: 'Leads monitored', value: '428' }, { label: 'Opportunities', value: '8' }, { label: 'Lift forecast', value: '12%' }] },
  { id: 'docs', name: 'Document Automation', description: 'Extracts key facts from documents and routes them to the right workflow.', impact: '8 hrs / month', status: 'Recommended', icon: 'DA', color: 'yellow', metrics: [{ label: 'Docs processed', value: '64' }, { label: 'Fields extracted', value: '512' }, { label: 'Accuracy', value: '97%' }] },
  { id: 'finder', name: 'Opportunity Finder', description: 'Scans your business for the next highest-value improvement to make.', impact: '$184K identified', status: 'Active', icon: 'OF', color: 'blue', metrics: [{ label: 'Signals scanned', value: '1.2K' }, { label: 'Opportunities', value: '12' }, { label: 'Reviewed', value: '8' }] },
]

export const activities = [
  { title: 'Proposal created for Acme Corp', time: '2 hours ago', status: 'Completed' },
  { title: 'Follow-up email sent to Jorge', time: '4 hours ago', status: 'Completed' },
  { title: 'Template updated', time: '1 day ago', status: 'Completed' },
  { title: 'Market analysis added', time: '1 day ago', status: 'Completed' },
]

export const healthItems = [
  { label: 'Financial health', score: 82, color: '#2563ff' },
  { label: 'Sales & customers', score: 71, color: '#6e86ff' },
  { label: 'Operations', score: 76, color: '#2563ff' },
  { label: 'People & productivity', score: 88, color: '#26a269' },
  { label: 'Marketing & growth', score: 64, color: '#f0a429' },
  { label: 'Tools & subscriptions', score: 79, color: '#2563ff' },
  { label: 'Risk & compliance', score: 91, color: '#26a269' },
  { label: 'Market opportunities', score: 73, color: '#6e86ff' },
]
