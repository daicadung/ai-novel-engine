import { describe, expect, it } from 'vitest';
import { generateMvpNovel } from '../pipeline';
import { mapMvpNovelToPersistence } from '../persistence';

describe('MVP pipeline', () => {
  it('runs title to checked chapters without external services', () => {
    const novel = generateMvpNovel('Ta La Kiem De', { chapterCount: 5 });

    expect(novel.concept.title).toContain('Ta La Kiem De');
    expect(novel.plan.chapter_outlines).toHaveLength(5);
    expect(novel.chapters).toHaveLength(5);
    expect(novel.chapters.every(chapter => chapter.continuity.pass)).toBe(true);
    expect(novel.chapters.every(chapter => chapter.memory.story_events.length === 1)).toBe(true);
  });

  it('maps a generated novel to persistence payloads for core tables', () => {
    const novel = generateMvpNovel('Ta La Kiem De', { chapterCount: 50 });
    const payloads = mapMvpNovelToPersistence(novel, {
      ownerId: '00000000-0000-4000-8000-000000000001',
      novelId: '00000000-0000-4000-8000-000000000002'
    });

    expect(payloads.novels).toHaveLength(1);
    expect(payloads.concept_candidates).toHaveLength(1);
    expect(payloads.story_dna).toHaveLength(1);
    expect(payloads.story_bibles).toHaveLength(1);
    expect(payloads.worlds).toHaveLength(1);
    expect(payloads.characters.length).toBeGreaterThan(0);
    expect(payloads.arcs.length).toBeGreaterThan(0);
    expect(payloads.chapter_outlines).toHaveLength(50);
    expect(payloads.chapters).toHaveLength(50);
    expect(payloads.character_states.length).toBeGreaterThanOrEqual(50);
    expect(payloads.story_events.length).toBeGreaterThanOrEqual(50);
  });
});
