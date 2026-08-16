import { describe, expect, it } from 'vitest';
import { generateMvpNovel } from '../pipeline';
import { buildMvpInsertPlan, mapMvpNovelToPersistence } from '../persistence';

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

  it('builds a parameterized SQL insert plan in FK-safe order', () => {
    const novel = generateMvpNovel('Ta La Kiem De', { chapterCount: 3 });
    const payloads = mapMvpNovelToPersistence(novel, {
      ownerId: '00000000-0000-4000-8000-000000000001',
      novelId: '00000000-0000-4000-8000-000000000002'
    });
    const plan = buildMvpInsertPlan(payloads);

    expect(plan.statements[0].text).toMatch(/^INSERT INTO novels /);
    expect(plan.statements.some(statement => statement.text.startsWith('INSERT INTO chapters '))).toBe(true);
    expect(plan.statements.every(statement => statement.text.includes('ON CONFLICT DO NOTHING'))).toBe(true);
    expect(plan.statements.every(statement => !statement.text.includes('Ta La Kiem De'))).toBe(true);
    expect(plan.statements.every(statement => statement.values.length > 0)).toBe(true);
    expect(plan.statements.flatMap(statement => statement.values).some(value => value === '["control sword vein mines"]')).toBe(true);
    expect(
      plan.statements.findIndex(statement => statement.text.startsWith('INSERT INTO arcs '))
    ).toBeLessThan(
      plan.statements.findIndex(statement => statement.text.startsWith('INSERT INTO sub_arcs '))
    );
    expect(
      plan.statements.findIndex(statement => statement.text.startsWith('INSERT INTO chapter_outlines '))
    ).toBeLessThan(
      plan.statements.findIndex(statement => statement.text.startsWith('INSERT INTO chapters '))
    );
  });
});
