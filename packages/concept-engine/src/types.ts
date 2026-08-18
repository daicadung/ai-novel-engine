export interface ConceptCandidate {
  title: string;
  premise: string;
  genre?: string;
  setting?: string;
  protagonist_archetype?: string;
  theme?: string;
  conflict?: string;
  progression_model?: string;
  power_system?: string;
  narrative_structure?: string;
  ending_direction?: string;
}

export interface ConceptGenerationResult {
  candidates: ConceptCandidate[];
  rawPayload: unknown;
}

export interface StoryDna {
  concept_dna: Record<string, unknown>;
  world_dna: Record<string, unknown>;
  character_dna: Record<string, unknown>;
  power_system_dna: Record<string, unknown>;
  faction_dna: Record<string, unknown>;
  plot_dna: Record<string, unknown>;
  arc_dna: Record<string, unknown>;
  event_dna: Record<string, unknown>;
  ending_dna: Record<string, unknown>;
}

export type SimilarityDecision = 'accept' | 'modify' | 'review' | 'reject';

export interface SimilarityDecisionResult {
  score: number;
  decision: SimilarityDecision;
  reasons: string[];
}

export interface ConceptEngineOptions {
  provider: import('@ai-novel-engine/llm-gateway').LlmProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}
