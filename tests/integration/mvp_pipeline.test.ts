import { describe, expect, it } from 'vitest';
import { buildMvpInsertPlan, generateMvpNovel, mapMvpNovelToPersistence } from '../../packages/mvp-pipeline/src';

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
    expect(payloads.arcs.every(row => isUuid(row.id))).toBe(true);
    expect(payloads.sub_arcs.every(row => isUuid(row.id) && isUuid(row.arc_id))).toBe(true);
    expect(payloads.chapter_outlines.every(row =>
      isUuid(row.id) && isUuid(row.arc_id) && isUuid(row.sub_arc_id)
    )).toBe(true);
    expect(payloads.chapters.every(row => isUuid(row.id) && isUuid(row.outline_id))).toBe(true);
    expect(payloads.character_states.every(row => isUuid(row.id) && isUuid(row.character_id))).toBe(true);

    const insertPlan = buildMvpInsertPlan(payloads);
    expect(insertPlan.statements.length).toBeGreaterThan(50);
    expect(insertPlan.statements[0].text).toMatch(/^INSERT INTO novels /);
    expect(insertPlan.statements.every(statement => !statement.text.includes('Ta La Kiem De'))).toBe(true);
    expect(insertPlan.statements.every(statement => statement.values.length > 0)).toBe(true);
  });
});

function isUuid(value: unknown): boolean {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}
