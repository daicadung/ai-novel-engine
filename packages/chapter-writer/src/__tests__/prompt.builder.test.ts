import { describe, it, expect } from 'vitest';
import { buildWriterSystemPrompt, buildWriterUserPrompt } from '../prompts/writer.prompt';
import { WriterContext } from '../types';

describe('Prompt Builder', () => {
  const dummyContext: WriterContext = {
      target_outline: {
      id: 'o1',
      arc_id: 'a1',
      sub_arc_id: 'sa1',
      chapter_number: 10,
      title: 'T',
      purpose: 'P',
      status: 'planned' as const,
      outline: { description: 'Beat 1' }
    },
    previous_summaries: ['Sum 8', 'Sum 9'],
    relevant_characters: [{ name: 'Alice', role: 'Hero', description: 'Brave', personality: {}, goals: [], secrets: [], metadata: {} }],
    relevant_locations: [{ name: 'City', kind: 'Town', description: 'Big', metadata: {} }],
    active_plot_threads: [{ id: 'pt1', title: 'Find ring', status: 'open', priority: 1, description: '', metadata: {} }],
    recent_story_events: [],
    style_guide: {
      language: 'English',
      tone: 'Dark',
      pov: 'Third',
      tense: 'Past',
      prose_density: 'High',
      dialogue_ratio: 'Low',
      taboo_phrases: ['taboo word'],
      required_rules: ['Rule 1']
    },
    world_rules: { Magic: 'Hard' },
    continuity_notes: ''
  };

  it('builds system prompt without leaking provider info and with strict JSON schema', () => {
    const prompt = buildWriterSystemPrompt(dummyContext);
    expect(prompt).toContain('Dark');
    expect(prompt).toContain('taboo word');
    expect(prompt).toContain('Output exactly and only valid JSON');
    expect(prompt).not.toContain('openai');
    expect(prompt).not.toContain('gemini');
    expect(prompt).not.toContain('anthropic');
  });

  it('builds user prompt with serialized context components', () => {
    const prompt = buildWriterUserPrompt(dummyContext);
    expect(prompt).toContain('Chapter 10');
    expect(prompt).toContain('Sum 9');
    expect(prompt).toContain('Alice');
    expect(prompt).toContain('City');
    expect(prompt).toContain('Find ring');
    expect(prompt).toContain('Beat 1');
  });
});
