import { describe, expect, it } from 'vitest';
import { generateMvpNovel } from '../../packages/mvp-pipeline/src';

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
  });
});
