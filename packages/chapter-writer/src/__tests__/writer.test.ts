import { describe, it, expect } from 'vitest';
import { ChapterWriter } from '../core/writer';
import { MockAdapter, LlmGateway } from '@ai-novel-engine/llm-gateway';
import { WriterContext } from '../types';

describe('Chapter Writer', () => {
  it('calls the gateway and parses the valid json response', async () => {
    const mockAdapter = new MockAdapter();
    const gateway = new LlmGateway({ mock: mockAdapter });

    const writer = new ChapterWriter(gateway);

    const validJson = JSON.stringify({
      title: 'A New Beginning',
      content: 'Once upon a time...',
      summary: 'They started a journey.',
      word_count: 500,
      advanced_plot_threads: ['Thread 1'],
      introduced_facts: [],
      continuity_risks: []
    });

    // Configure the mock to return our json
    mockAdapter.setMockResponse('mock-model', {
      provider: 'mock',
      model: 'mock-model',
      message: { role: 'assistant', content: validJson },
      usage: { input_tokens: 10, output_tokens: 50, total_tokens: 60 }
    });

    const context: WriterContext = {
      target_outline: { id: 'o1', arc_id: 'a1', sub_arc_id: 'sa1', chapter_number: 1, title: 'T', purpose: 'P', outline: {}, status: 'planned' },
      previous_summaries: [],
      relevant_characters: [],
      relevant_locations: [],
      active_plot_threads: [],
      recent_story_events: [],
      style_guide: {
        language: 'English',
        tone: 'Dark',
        pov: 'Third',
        tense: 'Past',
        prose_density: 'High',
        dialogue_ratio: 'Low',
        taboo_phrases: [],
        required_rules: []
      },
      world_rules: {},
      continuity_notes: ''
    };

    const draft = await writer.write(context, { provider: 'mock', model: 'mock-model' });

    expect(draft.title).toBe('A New Beginning');
    expect(draft.content).toBe('Once upon a time...');
    expect(draft.summary).toBe('They started a journey.');
    expect(draft.word_count).toBe(500);

  });
});
