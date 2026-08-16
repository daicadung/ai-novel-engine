import { describe, it, expect } from 'vitest';
import { extractMemoryHintsFromDraft } from '../core/hints';
import { ChapterDraft } from '@ai-novel-engine/chapter-writer';

describe('Memory Hints Extractor', () => {
  it('extracts hints deterministically from draft', () => {
    const draft: ChapterDraft = {
      title: 'T',
      content: 'C',
      summary: 'Summary 1',
      word_count: 100,
      introduced_facts: ['Fact A'],
      advanced_plot_threads: ['Thread A'],
      continuity_risks: ['Risk A']
    };

    const hints = extractMemoryHintsFromDraft(draft, 5);
    expect(hints.chapter_number).toBe(5);
    expect(hints.summary).toBe('Summary 1');
    expect(hints.introduced_facts).toContain('Fact A');
    expect(hints.advanced_plot_threads).toContain('Thread A');
    expect(hints.continuity_risks).toContain('Risk A');
  });
});
