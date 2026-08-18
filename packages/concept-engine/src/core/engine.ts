import { LlmGateway } from '@ai-novel-engine/llm-gateway';
import { ConceptCandidate, ConceptEngineOptions, ConceptGenerationResult, StoryDna } from '../types';
import { buildConceptGenerationPrompt } from '../prompts/concept.prompt';
import { buildStoryDnaPrompt } from '../prompts/dna.prompt';
import { parseConceptCandidates } from '../parsers/concept.parser';
import { parseStoryDna } from '../parsers/dna.parser';

export class ConceptEngine {
  constructor(
    private gateway: LlmGateway,
    private config: ConceptEngineOptions
  ) {}

  public async generateConcepts(title: string): Promise<ConceptGenerationResult> {
    const messages = buildConceptGenerationPrompt(title);

    const response = await this.gateway.generate(
      {
        provider: this.config.provider,
        model: this.config.model,
        messages,
        temperature: this.config.temperature ?? 0.8,
        max_tokens: this.config.maxTokens ?? 2000,
        timeoutMs: this.config.timeoutMs,
      },
      { provider: this.config.provider, model: this.config.model }
    );

    const content = response.message.content;
    return parseConceptCandidates(content);
  }

  public async extractStoryDna(concept: ConceptCandidate): Promise<StoryDna> {
    const messages = buildStoryDnaPrompt(concept);

    const response = await this.gateway.generate(
      {
        provider: this.config.provider,
        model: this.config.model,
        messages,
        temperature: 0.1,
        max_tokens: this.config.maxTokens ?? 3000,
        timeoutMs: this.config.timeoutMs,
      },
      { provider: this.config.provider, model: this.config.model }
    );

    const content = response.message.content;
    return parseStoryDna(content);
  }
}
