import { describe, it, expect } from 'vitest';
import { buildRepairPrompt } from '../prompts/repair.prompt';
import { ContinuityReport } from '../types';
import { ChapterDraft, WriterContext } from '@ai-novel-engine/chapter-writer';

describe('Repair Prompt Builder', () => {
  it('builds repair prompt with original content and issues', () => {
    const draft: ChapterDraft = {
      title: 'T',
      content: 'Hero swung his sword.',
      summary: '',
      word_count: 10,
      advanced_plot_threads: [],
      introduced_facts: [],
      continuity_risks: []
    };

    const report: ContinuityReport = {
      pass: false,
      issues: [
        { severity: 'critical', description: 'Sword is broken.', rule_violated: 'Cannot use destroyed items' }
      ]
    };

    const ctx: WriterContext = {
      target_outline: { id: 'o1', arc_id: 'a1', sub_arc_id: 'sa1', chapter_number: 1, title: 'T', purpose: 'P', outline: { beat: 1 }, status: 'planned' },
      previous_summaries: [],
      relevant_characters: [],
      relevant_locations: [],
      active_plot_threads: [],
      recent_story_events: [],
      style_guide: { language: 'en', tone: 'dark', pov: '3rd', tense: 'past', prose_density: 'high', dialogue_ratio: 'low', taboo_phrases: [], required_rules: [] },
      world_rules: {},
      continuity_notes: ''
    };

    const prompt = buildRepairPrompt(draft, report, ctx);
    expect(prompt).toContain('Hero swung his sword.');
    expect(prompt).toContain('[CRITICAL] Sword is broken. (Rule: Cannot use destroyed items)');
    expect(prompt).toContain('revise the following chapter');
    expect(prompt).not.toContain('provider');
    expect(prompt).not.toContain('api_key');
  });
});
