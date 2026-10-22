export type ISODate = string

export interface EntityMetadata {
  createdAt: ISODate
  updatedAt: ISODate
  metadata?: Record<string, unknown>
}

export interface TenantScope {
  organizationId: string
  workspaceId: string
}

export interface TenantEntity extends EntityMetadata, TenantScope {
  id: string
  canonicalEntityId?: string
}

export type Role = 'Owner' | 'Admin' | 'Manager' | 'Member' | 'Viewer'
export type RecordStatus = 'active' | 'inactive' | 'archived'

export interface User extends EntityMetadata {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  status: 'active' | 'invited' | 'suspended'
}

export interface Organization extends EntityMetadata {
  id: string
  name: string
  slug: string
  status: RecordStatus
}

export interface Workspace extends TenantEntity {
  organizationId: string
  name: string
  slug: string
  timezone: string
  currency: string
  status: RecordStatus
}

export interface Membership extends EntityMetadata {
  id: string
  userId: string
  organizationId: string
  workspaceId: string
  role: Role
  status: 'active' | 'invited' | 'revoked'
}

export type IntegrationProviderType = 'quickbooks' | 'gmail' | 'outlook' | 'google_drive' | 'microsoft_365' | 'microsoft_calendar' | 'google_calendar' | 'onedrive' | 'slack' | 'hubspot' | 'salesforce' | 'shopify' | 'csv_excel'
export type PermissionLevel = 'observe' | 'recommend' | 'act'
export type ConnectionStatus = 'not_connected' | 'connecting' | 'connected' | 'ready' | 'syncing' | 'healthy' | 'needs_attention' | 'expired' | 'error' | 'disconnected'
export type SyncStatus = 'idle' | 'queued' | 'syncing' | 'synced' | 'failed'

export interface Integration extends TenantEntity {
  provider: IntegrationProviderType
  displayName: string
  status: ConnectionStatus
  permissionLevel: PermissionLevel
  lastSyncedAt?: ISODate
}

export interface IntegrationConnection extends TenantEntity {
  integrationId: string
  providerAccountId?: string
  realmId?: string
  connectedUserId?: string
  status: ConnectionStatus
  syncStatus: SyncStatus
  encryptedCredentialRef?: string
  scopes: string[]
  accessTokenExpiresAt?: ISODate
  refreshTokenExpiresAt?: ISODate
  lastSyncedAt?: ISODate
  lastSuccessfulSyncAt?: ISODate
  lastError?: string
}

export interface DataSource extends TenantEntity {
  integrationId?: string
  name: string
  provider: IntegrationProviderType | 'internal'
  recordType: string
  syncStatus: SyncStatus
  lastObservedAt?: ISODate
}

export interface BusinessMetric extends TenantEntity {
  dataSourceId?: string
  key: string
  name: string
  category: 'financial' | 'sales' | 'operations' | 'customers' | 'productivity' | 'marketing' | 'risk' | 'tools'
  unit: 'currency' | 'number' | 'percentage' | 'duration' | 'days' | 'score'
  description?: string
  status: RecordStatus
}

export interface MetricObservation extends TenantEntity {
  metricId: string
  value: number
  observedAt: ISODate
  periodStart: ISODate
  periodEnd: ISODate
  sourceRecordIds: string[]
}

export type SignalDirection = 'up' | 'down' | 'flat'
export type Severity = 'low' | 'medium' | 'high' | 'critical'

export interface Signal extends TenantEntity {
  metricId: string
  sourceId?: string
  name: string
  description: string
  currentValue: number
  baselineValue: number
  absoluteChange: number
  percentageChange: number
  direction: SignalDirection
  severity: Severity
  detectedAt: ISODate
  confidence: number
  observationIds: string[]
  status: 'open' | 'acknowledged' | 'resolved'
}

export interface Evidence extends TenantEntity {
  sourceSystem: IntegrationProviderType | 'internal'
  sourceRecordId?: string
  sourceRecordIds?: string[]
  sourceEntityType?: string
  metricId?: string
  signalId?: string
  observedValue: number | string
  comparisonValue?: number | string
  observedAt: ISODate
  periodStart?: ISODate
  periodEnd?: ISODate
  description: string
  strength: number
  relevance: number
  sourceRealmId?: string
  sourceUpdatedAt?: ISODate
  synchronizedAt?: ISODate
}

export interface BusinessImpact {
  estimatedRevenueUpside?: number
  estimatedSavings?: number
  estimatedAnnualValue: number
  currency: string
  origin?: FinancialMetricOrigin
}

export interface Issue extends TenantEntity {
  title: string
  description: string
  severity: Severity
  category: string
  signalIds: string[]
  evidenceIds: string[]
  rootCauseIds: string[]
  impact: BusinessImpact
  confidence: number
  status: 'open' | 'in_review' | 'resolved' | 'dismissed'
}

export interface RootCause extends TenantEntity {
  issueId: string
  title: string
  explanation: string
  contributingFactorIds: string[]
  evidenceIds: string[]
  confidence: number
  order: number
  isPrimary: boolean
  certainty?: 'observed' | 'inferred' | 'unknown'
}

export type OpportunityStatus = 'identified' | 'prioritized' | 'in_progress' | 'completed' | 'dismissed'

export interface Opportunity extends TenantEntity {
  issueId: string
  rootCauseId?: string
  title: string
  category: string
  summary: string
  evidenceIds: string[]
  estimatedAnnualValue: number
  estimatedSavings: number
  estimatedRevenueUpside: number
  roi: number
  urgency: number
  confidence: number
  implementationDifficulty: number
  priorityScore: number
  status: OpportunityStatus
  recommendedAction?: string
  sourceSystem?: IntegrationProviderType | 'internal'
  analysisPeriod?: { start: ISODate; end: ISODate }
  impactOrigin?: FinancialMetricOrigin
}

export interface Solution extends TenantEntity {
  name: string
  description: string
  implementationComplexity: 'low' | 'medium' | 'high'
  requiredPermissions: PermissionLevel[]
  approvalRequired: boolean
}

export interface AIProvenance {
  provider: string
  model: string
  generatedAt: ISODate
  promptVersion: string
  confidence?: number
  sourceEvidenceIds: string[]
}

export interface Recommendation extends TenantEntity {
  opportunityId: string
  solutionId: string
  rationale: string
  evidenceIds: string[]
  expectedBenefit: string
  expectedROI: number
  estimatedTimeSavedHours: number
  implementationComplexity: 'low' | 'medium' | 'high'
  confidence: number
  risks: string[]
  requiredPermissions: PermissionLevel[]
  approvalRequired: boolean
  aiProvenance?: AIProvenance
  status: 'draft' | 'ready' | 'accepted' | 'rejected' | 'deployed'
}

export type AgentStatus = 'recommended' | 'active' | 'paused' | 'retired'

export interface Agent extends TenantEntity {
  name: string
  description: string
  status: AgentStatus
  requiredPermissions: PermissionLevel[]
  configuration: Record<string, string | number | boolean>
}

export type AgentRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface AgentRun extends TenantEntity {
  agentId: string
  status: AgentRunStatus
  startedAt?: ISODate
  completedAt?: ISODate
  inputReference?: string
  outputReference?: string
  errorMessage?: string
}

export type ActionStatus = 'proposed' | 'awaiting_approval' | 'approved' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface Action extends TenantEntity {
  recommendationId?: string
  agentRunId?: string
  proposedByUserId?: string
  approvedByUserId?: string
  status: ActionStatus
  targetSystem: IntegrationProviderType | 'internal'
  operation: string
  requestedAt: ISODate
  approvedAt?: ISODate
  completedAt?: ISODate
  outcomeId?: string
  auditEventIds: string[]
}

export interface Approval extends TenantEntity {
  actionId: string
  requestedByUserId?: string
  reviewedByUserId?: string
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  requestedAt: ISODate
  reviewedAt?: ISODate
  reason?: string
}

export interface Outcome extends TenantEntity {
  actionId?: string
  recommendationId?: string
  metricId: string
  baselineValue: number
  postInterventionValue: number
  measuredAt: ISODate
  measurementStart: ISODate
  measurementEnd: ISODate
  timeSavedHours?: number
  costSaved?: number
  revenueGained?: number
  annualizedImpact?: number
  confidence: number
}

export interface ROIRecord extends TenantEntity {
  outcomeId: string
  baselineMetric: string
  postInterventionMetric: string
  timeSavedHours: number
  costSaved: number
  revenueGained: number
  annualizedImpact: number
  confidence: number
  measurementPeriodStart: ISODate
  measurementPeriodEnd: ISODate
  comparisonPeriodStart?: ISODate
  comparisonPeriodEnd?: ISODate
  measurementWindowDays?: number
  formula?: string
  assumptions?: string[]
  measuredComponents?: string[]
  estimatedComponents?: string[]
  sourceMetricIds?: string[]
}

export interface Insight extends TenantEntity {
  title: string
  summary: string
  category: string
  sourceIds: string[]
  generatedAt: ISODate
  status: 'new' | 'read' | 'archived'
  aiProvenance?: AIProvenance
}

export type NotificationType = 'alert' | 'update' | 'completed' | 'opportunity' | 'approval' | 'agent_activity'

export interface Notification extends TenantEntity {
  userId?: string
  type: NotificationType
  title: string
  description: string
  deepLink?: string
  readAt?: ISODate
  createdAt: ISODate
  updatedAt: ISODate
}

export interface AuditEvent extends TenantEntity {
  actorUserId?: string
  action: string
  resourceType: string
  resourceId?: string
  occurredAt: ISODate
  details?: Record<string, unknown>
}

export interface SourceProvenance {
  provider: IntegrationProviderType | 'internal'
  realmId?: string
  externalRecordId: string
  sourceEntityType: string
  sourceUpdatedAt?: ISODate
  synchronizedAt: ISODate
}

export interface NormalizedCustomer extends TenantEntity { name: string; email?: string; externalRefs: string[]; provenance: SourceProvenance }
export interface NormalizedVendor extends TenantEntity { name: string; email?: string; externalRefs: string[]; provenance: SourceProvenance }
export interface NormalizedInvoice extends TenantEntity { customerId?: string; amount: number; balance: number; issuedAt: ISODate; dueDate: ISODate; paidAt?: ISODate; status: 'open' | 'paid' | 'overdue'; provenance: SourceProvenance }
export interface NormalizedPayment extends TenantEntity { customerId?: string; invoiceIds: string[]; amount: number; paidAt: ISODate; provenance: SourceProvenance }
export interface NormalizedExpense extends TenantEntity { vendorId?: string; amount: number; occurredAt: ISODate; category?: string; provenance: SourceProvenance }
export interface NormalizedRevenueTransaction extends TenantEntity { customerId?: string; amount: number; occurredAt: ISODate; category?: string; provenance: SourceProvenance }
export interface NormalizedAccount extends TenantEntity { name: string; accountType: string; balance?: number; provenance: SourceProvenance }
export interface NormalizedProduct extends TenantEntity { name: string; sku?: string; active: boolean; provenance: SourceProvenance }
export interface NormalizedLead extends TenantEntity { source?: string; firstResponseAt?: ISODate; status: 'new' | 'qualified' | 'won' | 'lost'; provenance: SourceProvenance }
export interface NormalizedCommunicationEvent extends TenantEntity { actorId?: string; customerId?: string; channel: 'email' | 'slack' | 'phone' | 'meeting'; occurredAt: ISODate; responseTimeHours?: number; provenance: SourceProvenance }
export interface NormalizedDocument extends TenantEntity { name: string; type: string; sourceSystem: IntegrationProviderType | 'internal'; externalRef?: string; provenance: SourceProvenance }
export interface NormalizedSubscription extends TenantEntity { vendor: string; monthlyCost: number; seatCount?: number; utilizationPercent?: number; provenance: SourceProvenance }
export interface NormalizedInventoryRecord extends TenantEntity { product: string; quantity: number; projectedDaysRemaining: number; observedAt: ISODate; provenance: SourceProvenance }
export interface NormalizedEmployee extends TenantEntity { name: string; email?: string; department: string; role: string; provenance: SourceProvenance }
export interface NormalizedDeal extends TenantEntity { customerId?: string; ownerId?: string; title: string; amount: number; stage: 'new' | 'qualified' | 'proposal' | 'won' | 'lost'; openedAt: ISODate; expectedCloseAt?: ISODate; closedAt?: ISODate; firstResponseHours?: number; proposalTurnaroundHours?: number; provenance: SourceProvenance }
export interface NormalizedOrder extends TenantEntity { customerId?: string; orderNumber: string; total: number; orderedAt: ISODate; status: 'open' | 'fulfilled' | 'cancelled'; productIds: string[]; provenance: SourceProvenance }
export interface NormalizedCalendarEvent extends TenantEntity { ownerId?: string; title: string; startsAt: ISODate; endsAt: ISODate; eventType: 'meeting' | 'focus' | 'admin' | 'internal'; provenance: SourceProvenance }
export interface NormalizedTask extends TenantEntity { assigneeId?: string; title: string; status: 'open' | 'completed' | 'blocked'; createdAt: ISODate; completedAt?: ISODate; provenance: SourceProvenance }
export interface NormalizedPurchaseOrder extends TenantEntity { vendorId?: string; orderNumber: string; amount: number; orderedAt: ISODate; status: 'draft' | 'submitted' | 'received'; provenance: SourceProvenance }

export type FinancialMetricOrigin = 'quickbooks_reported' | 'gilar_calculated' | 'estimate'
export type DataCoverageStatus = 'available' | 'partial' | 'insufficient'

export interface FinancialMetric extends TenantEntity {
  key: string
  label: string
  value: number
  unit: 'currency' | 'number' | 'percentage' | 'days'
  origin: FinancialMetricOrigin
  confidence: number
  periodStart: ISODate
  periodEnd: ISODate
  sourceRecordIds: string[]
}

export interface DataCoverage extends TenantEntity {
  dimension: string
  percentage: number
  status: DataCoverageStatus
  confidence: number
  sourceIds: string[]
}

export type QuickBooksNormalizedRecord = NormalizedCustomer | NormalizedVendor | NormalizedInvoice | NormalizedPayment | NormalizedExpense | NormalizedRevenueTransaction | NormalizedAccount | NormalizedProduct
export type NormalizedBusinessRecord = QuickBooksNormalizedRecord | NormalizedLead | NormalizedCommunicationEvent | NormalizedDocument | NormalizedSubscription | NormalizedInventoryRecord | NormalizedEmployee | NormalizedDeal | NormalizedOrder | NormalizedCalendarEvent | NormalizedTask | NormalizedPurchaseOrder
