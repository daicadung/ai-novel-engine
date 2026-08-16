import { describe, it, expect } from 'vitest';
import { mapChapterDraftToPersistence } from '../mappers/persistence.mapper';
import { ChapterDraft } from '../types';

describe('Persistence Mapper', () => {
  it('maps ChapterDraft to Phase 1 chapters table columns', () => {
    const draft: ChapterDraft = {
      title: 'A New Beginning',
      content: 'Once upon a time...',
      summary: 'They started a journey.',
      word_count: 500,
      advanced_plot_threads: ['Thread 1'],
      introduced_facts: ['Fact 1'],
      continuity_risks: ['Risk 1']
    };

    const mapped = mapChapterDraftToPersistence(draft, 'novel-1', 'outline-1', 1);

    // Assert keys match Phase 1 exactly
    expect(Object.keys(mapped).sort()).toEqual([
      'novel_id',
      'outline_id',
      'chapter_number',
      'title',
      'content',
      'summary',
      'status',
      'word_count',
      'metadata'
    ].sort());

    expect(mapped.novel_id).toBe('novel-1');
    expect(mapped.outline_id).toBe('outline-1');
    expect(mapped.chapter_number).toBe(1);
    expect(mapped.status).toBe('draft');
    expect(mapped.title).toBe('A New Beginning');
    expect(mapped.content).toBe('Once upon a time...');
    expect(mapped.summary).toBe('They started a journey.');
    expect(mapped.word_count).toBe(500);

    const metadata = mapped.metadata as Record<string, unknown>;
    expect(metadata.advanced_plot_threads).toEqual(['Thread 1']);
    expect(metadata.introduced_facts).toEqual(['Fact 1']);
    expect(metadata.continuity_risks).toEqual(['Risk 1']);
  });
});
