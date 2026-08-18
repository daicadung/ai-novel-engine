import { LlmGateway } from '@ai-novel-engine/llm-gateway';
import { StoryArchitectInput, StoryBibleDraft, StoryArchitectConfig } from '../types';
import { buildCoreBiblePrompt, buildCharactersPrompt, buildElementsPrompt } from '../prompts/bible.prompt';
import { parseStoryBibleDraft } from '../parsers/bible.parser';

export class StoryArchitect {
  constructor(
    private readonly gateway: LlmGateway,
    private readonly config: StoryArchitectConfig
  ) {}

  private async generateWithRetry(messages: any[], stepName: string, abortSignal?: AbortSignal): Promise<string> {
    let lastError;
    for (let i = 0; i < 3; i++) {
      try {
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
          throw new Error(`LLM returned empty content for ${stepName}.`);
        }
        
        return jsonText;
      } catch (e: any) {
        lastError = e;
        console.error(`\n❌ [DEBUG] Lỗi ${stepName} (Lần ${i+1}/3): ${e.message}. Thử lại...`);
      }
    }
    throw lastError;
  }

  async generateStoryBible(input: StoryArchitectInput, abortSignal?: AbortSignal): Promise<{ draft: StoryBibleDraft, rawPayload: string }> {
    // Step 1: Core Bible
    if (input.onProgress) input.onProgress('Bước 1.3.1: Xây dựng Core World (Luật thế giới & Cốt truyện chính)...');
    const coreMessages = buildCoreBiblePrompt(input);
    const coreBibleText = await this.generateWithRetry(coreMessages, 'CoreBible', abortSignal);

    // Step 2: Characters
    if (input.onProgress) input.onProgress('Bước 1.3.2: Xây dựng Nhân vật & Thế lực...');
    const characterMessages = buildCharactersPrompt(input, coreBibleText);
    const charactersText = await this.generateWithRetry(characterMessages, 'Characters', abortSignal);

    // Step 3: Elements
    if (input.onProgress) input.onProgress('Bước 1.3.3: Xây dựng Hệ thống sức mạnh, Địa điểm & Vật phẩm...');
    const elementMessages = buildElementsPrompt(input, coreBibleText, charactersText);
    const elementsText = await this.generateWithRetry(elementMessages, 'Elements', abortSignal);

    // Merge them together into a valid JSON string for parser
    let mergedPayload = '';
    try {
      const coreJson = JSON.parse(coreBibleText.replace(/^```json/, '').replace(/```$/, '').trim());
      const charJson = JSON.parse(charactersText.replace(/^```json/, '').replace(/```$/, '').trim());
      const elemJson = JSON.parse(elementsText.replace(/^```json/, '').replace(/```$/, '').trim());
      
      const mergedJson = {
        ...coreJson,
        ...charJson,
        ...elemJson
      };
      
      mergedPayload = JSON.stringify(mergedJson);
    } catch (e: any) {
      console.error('Failed to merge JSON pieces. The LLM output might be malformed.');
      throw new Error(`Failed to parse one of the JSON pieces: ${e.message}`);
    }

    const draft = parseStoryBibleDraft(mergedPayload);
    return { draft, rawPayload: mergedPayload };
  }
}
