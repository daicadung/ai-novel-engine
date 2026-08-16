import { describe, it, expect } from 'vitest';
import { MemoryExtractor } from '../core/extractor';
import { MockAdapter, LlmGateway } from '@ai-novel-engine/llm-gateway';
import { ChapterDraft } from '@ai-novel-engine/chapter-writer';

describe('Memory Extractor', () => {
  it('orchestrates extraction with LlmGateway successfully', async () => {
    const mockAdapter = new MockAdapter();
    const gateway = new LlmGateway({ mock: mockAdapter });
    const extractor = new MemoryExtractor(gateway);

    const validJson = JSON.stringify({
      chapter_number: 1,
      character_deltas: [{ character_name: 'Hero' }],
      relationship_deltas: [],
      location_deltas: [],
      item_deltas: [],
      plot_thread_deltas: [],
      story_events: [],
      foreshadowing: []
    });

    mockAdapter.setMockResponse('mock-model', {
      provider: 'mock',
      model: 'mock-model',
      message: { role: 'assistant', content: validJson },
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 }
    });

    const draft: ChapterDraft = {
      title: 'T', content: 'C', summary: 'S', word_count: 10, advanced_plot_threads: [], introduced_facts: [], continuity_risks: []
    };

    const result = await extractor.extract(draft, 1, { provider: 'mock', model: 'mock-model' });

    expect(result.chapter_number).toBe(1);
    expect(result.character_deltas).toHaveLength(1);
    expect(result.character_deltas[0].character_name).toBe('Hero');
  });
});
