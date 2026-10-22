import type { AIProvenance } from '../../shared/domain/models'

export interface AIRequest {
  task: 'explain_signal' | 'synthesize_evidence' | 'suggest_root_causes' | 'generate_recommendation' | 'summarize_business_status'
  input: string
  sourceEvidenceIds: string[]
}

export interface AIResponse {
  text: string
  provenance: AIProvenance
}

export interface AIProvider {
  complete(request: AIRequest): Promise<AIResponse>
}

/** Deterministic fallback used for local development and safe previews. */
export class NoopAIProvider implements AIProvider {
  async complete(request: AIRequest): Promise<AIResponse> {
    const generatedAt = new Date().toISOString()
    return {
      text: `${request.task} result pending human review: ${request.input}`,
      provenance: { provider: 'gilar-deterministic', model: 'noop-v1', generatedAt, promptVersion: 'none', confidence: 0.5, sourceEvidenceIds: request.sourceEvidenceIds },
    }
  }
}
