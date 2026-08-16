import { LlmGateway } from '@ai-novel-engine/llm-gateway';
import { WriterContext, ChapterDraft, WriterConfig } from '../types';
import { buildWriterSystemPrompt, buildWriterUserPrompt } from '../prompts/writer.prompt';
import { parseChapterDraft } from '../parsers/writer.parser';

export class ChapterWriter {
  constructor(private readonly gateway: LlmGateway) {}

  public async write(context: WriterContext, config: WriterConfig): Promise<ChapterDraft> {
    const systemPrompt = buildWriterSystemPrompt(context);
    const userPrompt = buildWriterUserPrompt(context);

    const response = await this.gateway.generate({
      provider: config.provider,
      model: config.model,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens,
      timeoutMs: config.timeoutMs,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    }, {
      provider: config.provider,
      model: config.model
    });

    return parseChapterDraft(response.message.content);
  }
}
