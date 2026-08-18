import { LlmGateway } from '@ai-novel-engine/llm-gateway';
import { StoryArchitectInput, StoryBibleDraft, StoryArchitectConfig } from '../types';
import { buildStoryBiblePrompt } from '../prompts/bible.prompt';
import { parseStoryBibleDraft } from '../parsers/bible.parser';

export class StoryArchitect {
  constructor(
    private readonly gateway: LlmGateway,
    private readonly config: StoryArchitectConfig
  ) {}

  async generateStoryBible(input: StoryArchitectInput, abortSignal?: AbortSignal): Promise<{ draft: StoryBibleDraft, rawPayload: string }> {
    const messages = buildStoryBiblePrompt(input);

    const result = await this.gateway.generate(
      {
        provider: this.config.provider,
        model: this.config.model,
        temperature: this.config.temperature ?? 0.7,
        messages,
        max_tokens: this.config.maxTokens ?? 4000,
        timeoutMs: this.config.timeoutMs,
        abortSignal,
      },
      {
        provider: this.config.provider,
        model: this.config.model,
      }
    );

    const jsonText = result.message.content;
    if (!jsonText) {
      throw new Error('LLM returned empty content for Story Bible.');
    }

    const draft = parseStoryBibleDraft(jsonText);

    return { draft, rawPayload: jsonText };
  }
}
