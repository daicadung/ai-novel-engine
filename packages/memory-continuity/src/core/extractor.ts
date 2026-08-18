import { LlmGateway } from '@ai-novel-engine/llm-gateway';
import { ChapterDraft } from '@ai-novel-engine/chapter-writer';
import { ExtractedMemory } from '../types';
import { extractMemoryHintsFromDraft } from './hints';
import { buildMemorySystemPrompt, buildMemoryUserPrompt } from '../prompts/memory.prompt';
import { parseMemoryOutput } from '../parsers/memory.parser';

export interface MemoryExtractorConfig {
  provider: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'nine-router' | 'mock';
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export class MemoryExtractor {
  constructor(private readonly gateway: LlmGateway) {}

  public async extract(draft: ChapterDraft, chapterNumber: number, config: MemoryExtractorConfig): Promise<ExtractedMemory> {
    const hints = extractMemoryHintsFromDraft(draft, chapterNumber);
    const systemPrompt = buildMemorySystemPrompt();
    const userPrompt = buildMemoryUserPrompt(draft, hints);

    let lastError;
    for (let i = 0; i < 3; i++) {
      try {
        const response = await this.gateway.generate({
          provider: config.provider,
          model: config.model,
          temperature: config.temperature ?? 0.2,
          max_tokens: config.maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        }, {
          provider: config.provider,
          model: config.model
        });

        return parseMemoryOutput(response.message.content);
      } catch (e: any) {
        lastError = e;
        console.error(`\n❌ [DEBUG] Lỗi MemoryExtractor (Lần ${i+1}/3): ${e.message}. Thử lại...`);
      }
    }
    
    throw lastError;
  }
}
