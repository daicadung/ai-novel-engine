import { describe, expect, it } from 'vitest';
import { generateMvpNovel, mapMvpNovelToPersistence } from '../../packages/mvp-pipeline/src';

describe('MVP end-to-end contract', () => {
  it('proves title-only input can reach chapter memory and continuity checks', () => {
    const result = generateMvpNovel('Ta La Kiem De', { chapterCount: 50 });

    expect(result.title).toBe('Ta La Kiem De');
    expect(result.bible.characters.length).toBeGreaterThan(0);
    expect(result.plan.arcs.length).toBeGreaterThan(0);
    expect(result.plan.chapter_outlines).toHaveLength(50);
    expect(result.chapters).toHaveLength(50);
    expect(result.chapters.map(chapter => chapter.continuity.pass)).toEqual(Array(50).fill(true));
    expect(result.chapters.at(-1)?.memory.chapter_number).toBe(50);

    const payloads = mapMvpNovelToPersistence(result, {
      ownerId: '00000000-0000-4000-8000-000000000001',
      novelId: '00000000-0000-4000-8000-000000000002'
    });

    expect(payloads.novels[0]).toMatchObject({ title: 'Ta La Kiem De', status: 'active' });
    expect(payloads.concept_candidates[0]).toMatchObject({ status: 'selected', candidate_number: 1 });
    expect(payloads.story_dna[0]).toHaveProperty('concept_dna');
    expect(payloads.chapter_outlines).toHaveLength(50);
    expect(payloads.chapters).toHaveLength(50);
    expect(payloads.story_events.length).toBeGreaterThanOrEqual(50);
  });
});
