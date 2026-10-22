import express, { type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import type { ApiResult } from '../../shared/contracts/api'
import type { Opportunity, Recommendation, TenantScope } from '../../shared/domain/models'
import { createAuthProvider, requireSession, type AuthProvider, type AuthSession } from '../auth'
import { TenantAccessError } from '../repositories/interfaces'
import { createDemoApplicationServices, toOpportunityDTO, type ApplicationServices } from '../services/application'
import { env } from '../config/env'
import { QuickBooksConnector } from '../integrations/quickbooks/connector'
import { QuickBooksService } from '../integrations/quickbooks/service'
import { DrizzleQuickBooksAnalysisStore, DrizzleQuickBooksConnectionStore, InMemoryQuickBooksStore, QuickBooksRuntimeStore } from '../integrations/quickbooks/store'
import { createDatabase } from '../db/client'
import { hasPermission } from '../../shared/permissions'
import { SyntheticDemoService, type SyntheticScenario } from '../synthetic/service'

const actionInputSchema = z.object({
  recommendationId: z.string().min(1).optional(),
  targetSystem: z.enum(['quickbooks', 'gmail', 'outlook', 'google_drive', 'microsoft_365', 'microsoft_calendar', 'google_calendar', 'onedrive', 'slack', 'hubspot', 'salesforce', 'shopify', 'csv_excel', 'internal']),
  operation: z.string().min(1).max(160),
  requireApproval: z.boolean().default(true),
})
const syncInputSchema = z.object({ mode: z.enum(['initial', 'manual', 'incremental']).default('manual') })
const callbackQuerySchema = z.object({ code: z.string().min(1), state: z.string().min(1), realmId: z.string().min(1) })
const syntheticScenarioSchema = z.object({ scenario: z.enum(['baseline', 'low_confidence', 'partial_coverage', 'failed_action', 'no_roi', 'conflicting_evidence']) })
const pilotFeedbackSchema = z.object({ screen: z.string().min(1).max(80), entityType: z.string().min(1).max(80), entityId: z.string().max(160).optional(), opportunityId: z.string().max(160).optional(), recommendationId: z.string().max(160).optional(), helpful: z.boolean(), comment: z.string().max(500).optional() })
const pilotTelemetrySchema = z.object({ event: z.string().regex(/^[a-z0-9_]{2,80}$/), screen: z.string().min(1).max(80), entityType: z.string().max(80).optional(), entityId: z.string().max(160).optional() })

function sessionFrom(response: Response): AuthSession {
  return response.locals.session as AuthSession
}

function scopeFrom(response: Response): TenantScope {
  const session = sessionFrom(response)
  return { organizationId: session.membership.organizationId, workspaceId: session.membership.workspaceId }
}

function send<T>(response: Response, data: T, status = 200): void {
  const result: ApiResult<T> = { data }
  response.status(status).json(result)
}

function toQuickBooksRecommendation(opportunity: Opportunity): Recommendation {
  const now = new Date().toISOString()
  return {
    id: `recommendation_${opportunity.id}`,
    organizationId: opportunity.organizationId,
    workspaceId: opportunity.workspaceId,
    createdAt: now,
    updatedAt: now,
    opportunityId: opportunity.id,
    solutionId: 'solution_quickbooks_investigation',
    rationale: opportunity.summary,
    evidenceIds: opportunity.evidenceIds,
    expectedBenefit: opportunity.recommendedAction ?? 'Validate this accounting signal with the relevant business workflow before taking action.',
    expectedROI: opportunity.roi,
    estimatedTimeSavedHours: 0,
    implementationComplexity: opportunity.implementationDifficulty <= 1 ? 'low' : opportunity.implementationDifficulty <= 2 ? 'medium' : 'high',
    confidence: opportunity.confidence,
    risks: ['QuickBooks identifies the financial symptom; the operational cause remains unconfirmed until another data source is connected.'],
    requiredPermissions: ['observe'],
    approvalRequired: true,
    status: 'ready',
  }
}

export function createApp(services: ApplicationServices = createDemoApplicationServices(), authProvider: AuthProvider = createAuthProvider()) {
  const app = express()
  const syntheticService = new SyntheticDemoService()
  const memoryStore = new InMemoryQuickBooksStore()
  // Demo authentication uses fixture IDs rather than database UUIDs. Keep the
  // sandbox verifier self-contained; production database persistence requires
  // DEMO_MODE=false and the real AuthProvider.
  const database = env.DATABASE_URL && !env.DEMO_MODE ? createDatabase(env.DATABASE_URL).db : undefined
  const connectionStore = database ? new DrizzleQuickBooksConnectionStore(database) : memoryStore
  const analysisStore = database ? new DrizzleQuickBooksAnalysisStore(database) : memoryStore
  const quickBooksService = new QuickBooksService(new QuickBooksConnector(), new QuickBooksRuntimeStore(connectionStore, analysisStore), (scope, event) => services.auditService.record(scope, event).then(() => undefined))
  app.use(express.json({ limit: '256kb' }))

  app.get('/health', (_request, response) => response.json({ status: 'ok', service: 'gilar-api' }))

  app.use('/api', requireSession(authProvider))

  app.get('/api/session', async (_request, response) => send(response, sessionFrom(response)))
  app.get('/api/runtime', async (_request, response) => send(response, { mode: env.GILAR_MODE, demo: env.DEMO_MODE, synthetic: env.GILAR_MODE === 'synthetic', company: syntheticService.overview(scopeFrom(response)).company }))
  app.get('/api/synthetic/overview', async (_request, response) => send(response, syntheticService.overview(scopeFrom(response))))
  app.get('/api/synthetic/evidence', async (request, response) => {
    const overview = syntheticService.overview(scopeFrom(response))
    const issueId = typeof request.query.issueId === 'string' ? request.query.issueId : undefined
    const opportunityId = typeof request.query.opportunityId === 'string' ? request.query.opportunityId : undefined
    const opportunityEvidence = opportunityId ? new Set(overview.opportunities.find((item) => item.id === opportunityId)?.evidenceIds ?? []) : undefined
    const issueEvidence = issueId ? new Set(overview.issues.find((item) => item.id === issueId)?.evidenceIds ?? []) : undefined
    send(response, overview.evidence.filter((item) => (!opportunityEvidence || opportunityEvidence.has(item.id)) && (!issueEvidence || issueEvidence.has(item.id))))
  })
  app.post('/api/synthetic/simulation/advance', async (request, response) => {
    const input = z.object({ days: z.coerce.number().int().min(1).max(365) }).parse(request.body ?? {})
    const simulation = syntheticService.advance(scopeFrom(response), input.days)
    if (simulation.status === 'completed' && simulation.actionId) {
      try { await services.actionService.complete(scopeFrom(response), sessionFrom(response), simulation.actionId) } catch { /* The synthetic state remains authoritative if the action was reset separately. */ }
    }
    send(response, simulation)
  })
  app.post('/api/synthetic/reset', async (_request, response) => send(response, syntheticService.reset(scopeFrom(response))))
  app.post('/api/synthetic/scenario', async (request, response) => { const input = syntheticScenarioSchema.parse(request.body ?? {}); send(response, syntheticService.setScenario(scopeFrom(response), input.scenario as SyntheticScenario)) })
  app.post('/api/pilot/feedback', async (request, response) => { const input = pilotFeedbackSchema.parse(request.body ?? {}); send(response, syntheticService.recordFeedback(scopeFrom(response), input), 201) })
  app.post('/api/pilot/telemetry', async (request, response) => { const input = pilotTelemetrySchema.parse(request.body ?? {}); send(response, syntheticService.recordTelemetry(scopeFrom(response), input), 201) })
  app.get('/api/dashboard', async (_request, response) => send(response, await services.dashboardService.get(scopeFrom(response))))
  app.get('/api/business-health', async (_request, response) => {
    const quickBooksHealth = await quickBooksService.getHealthScore(scopeFrom(response))
    send(response, quickBooksHealth ?? await services.healthScoreService.get(scopeFrom(response)))
  })
  app.get('/api/opportunities', async (_request, response) => {
    const quickBooksAnalysis = await quickBooksService.getAnalysis(scopeFrom(response))
    const opportunities = quickBooksAnalysis?.opportunities ?? await services.opportunityService.list(scopeFrom(response))
    send(response, opportunities.map(toOpportunityDTO))
  })
  app.get('/api/opportunities/:id', async (request, response) => {
    const scope = scopeFrom(response)
    const quickBooksOpportunity = (await quickBooksService.getAnalysis(scope))?.opportunities.find((opportunity) => opportunity.id === request.params.id)
    send(response, toOpportunityDTO(quickBooksOpportunity ?? await services.opportunityService.get(scope, request.params.id)))
  })
  app.get('/api/issues/:id', async (request, response) => {
    const scope = scopeFrom(response)
    const quickBooksAnalysis = await quickBooksService.getAnalysis(scope)
    const issue = quickBooksAnalysis?.issues.find((candidate) => candidate.id === request.params.id) ?? await services.diagnosisService.getIssue(scope, request.params.id)
    const rootCauses = quickBooksAnalysis?.rootCauses.filter((rootCause) => rootCause.issueId === issue.id) ?? await services.diagnosisService.getRootCauses(scope, issue.id)
    const evidence = quickBooksAnalysis?.evidence.filter((item) => issue.evidenceIds.includes(item.id)) ?? await services.diagnosisService.getEvidence(scope, issue.id)
    const opportunity = quickBooksAnalysis?.opportunities.find((candidate) => candidate.issueId === issue.id)
    send(response, { issue, rootCauses, evidence, opportunityId: opportunity?.id, recommendedAction: opportunity?.recommendedAction })
  })
  app.get('/api/recommendations/:id', async (request, response) => {
    const quickBooksOpportunity = (await quickBooksService.getAnalysis(scopeFrom(response)))?.opportunities.find((opportunity) => `recommendation_${opportunity.id}` === request.params.id || opportunity.id === request.params.id)
    send(response, quickBooksOpportunity ? toQuickBooksRecommendation(quickBooksOpportunity) : await services.recommendationService.get(scopeFrom(response), request.params.id))
  })
  app.get('/api/insights', async (_request, response) => send(response, await services.insightService.list(scopeFrom(response))))
  app.get('/api/notifications', async (_request, response) => {
    const session = sessionFrom(response)
    send(response, await services.notificationService.list(scopeFrom(response), session.user.id))
  })
  app.get('/api/integrations', async (_request, response) => send(response, await services.integrationService.list(scopeFrom(response))))
  app.get('/api/agents', async (_request, response) => send(response, await services.agentService.list(scopeFrom(response))))
  app.get('/api/roi', async (_request, response) => send(response, await services.roiService.list(scopeFrom(response))))

  app.get('/api/integrations/quickbooks/connect', async (_request, response) => {
    const session = sessionFrom(response)
    if (!hasPermission(session.membership, 'manage_integrations')) { response.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to manage integrations.' } }); return }
    send(response, { provider: 'quickbooks', environment: env.INTUIT_ENVIRONMENT, authorizationUrl: quickBooksService.getAuthorizationUrl(scopeFrom(response), session.user.id) })
  })
  app.get('/api/integrations/quickbooks/callback', async (request, response) => {
    const session = sessionFrom(response)
    if (!hasPermission(session.membership, 'manage_integrations')) { response.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to manage integrations.' } }); return }
    const errorRedirect = `${env.APP_ORIGIN}/onboarding/connect?quickbooks=error`
    if (typeof request.query.error === 'string') {
      if (typeof request.query.state === 'string') quickBooksService.cancelAuthorization(scopeFrom(response), request.query.state)
      response.redirect(303, errorRedirect)
      return
    }
    try {
      const query = callbackQuerySchema.parse(request.query)
      await quickBooksService.completeAuthorization(scopeFrom(response), query.code, query.state, query.realmId, session.user.id)
      response.redirect(303, `${env.APP_ORIGIN}/onboarding/sync?quickbooks=connected`)
    } catch {
      response.redirect(303, errorRedirect)
    }
  })
  app.get('/api/integrations/quickbooks/status', async (_request, response) => send(response, await quickBooksService.status(scopeFrom(response))))
  app.post('/api/integrations/quickbooks/sync', async (request, response) => {
    const session = sessionFrom(response)
    if (!hasPermission(session.membership, 'manage_integrations')) { response.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to manage integrations.' } }); return }
    const input = syncInputSchema.parse(request.body ?? {})
    send(response, await quickBooksService.sync(scopeFrom(response), input.mode))
  })
  app.delete('/api/integrations/quickbooks', async (_request, response) => {
    const session = sessionFrom(response)
    if (!hasPermission(session.membership, 'manage_integrations')) { response.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to manage integrations.' } }); return }
    await quickBooksService.disconnect(scopeFrom(response), session.user.id)
    send(response, { disconnected: true })
  })

  app.post('/api/actions', async (request, response) => {
    const input = actionInputSchema.parse(request.body)
    const action = await services.actionService.propose(scopeFrom(response), sessionFrom(response), input)
    if (input.recommendationId?.includes('opportunity_proposal_intelligence')) syntheticService.propose(scopeFrom(response), action)
    send(response, action, 201)
  })
  app.post('/api/actions/:id/approve', async (request, response) => {
    const action = await services.actionService.approve(scopeFrom(response), sessionFrom(response), request.params.id)
    if (syntheticService.overview(scopeFrom(response)).simulation.actionId === action.id) syntheticService.approve(scopeFrom(response), action)
    send(response, action)
  })
  app.post('/api/actions/:id/deploy', async (request, response) => {
    const action = await services.actionService.deploy(scopeFrom(response), sessionFrom(response), request.params.id)
    if (syntheticService.overview(scopeFrom(response)).simulation.actionId === action.id) syntheticService.deploy(scopeFrom(response), action)
    send(response, action)
  })
  app.get('/api/actions/:id', async (request, response) => send(response, await services.actionService.get(scopeFrom(response), request.params.id)))

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const requestId = crypto.randomUUID()
    if (error instanceof z.ZodError) {
      response.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'The request payload is invalid.', requestId, details: error.issues } })
      return
    }
    if (error instanceof TenantAccessError) {
      response.status(404).json({ error: { code: error.code, message: 'The requested resource was not found.', requestId } })
      return
    }
    const message = error instanceof Error ? error.message : 'Unexpected server error.'
    const status = message.includes('permission') || message.includes('role') ? 403 : 400
    response.status(status).json({ error: { code: status === 403 ? 'FORBIDDEN' : 'REQUEST_FAILED', message: status === 400 ? message : 'You do not have permission to perform this action.', requestId } })
  })

  return app
}
