import { describe, expect, it } from 'vitest';
import { generateMvpNovel, generateMvpNovelWithGateway } from '../pipeline';
import { buildMvpInsertPlan, mapMvpNovelToPersistence } from '../persistence';
import { LlmGateway, LlmRequest } from '@ai-novel-engine/llm-gateway';

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

  it('uses an LLM gateway for chapter prose when configured', async () => {
    let calls = 0;
    const gateway = new LlmGateway({
      mock: {
        async generate(request: LlmRequest) {
          calls++;
          return {
            provider: 'mock',
            model: request.model,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                title: `Chương AI ${calls}`,
                content: `Đây là nội dung AI riêng cho chương ${calls}.`,
                summary: `Tóm tắt chương ${calls}.`,
                word_count: 12,
                advanced_plot_threads: ['Khôi phục kiếm mạch đã mất'],
                introduced_facts: [`Dấu hiệu riêng ${calls}`],
                continuity_risks: []
              })
            }
          };
        }
      }
    });

    const novel = await generateMvpNovelWithGateway(
      'Ta La Kiem De',
      gateway,
      { provider: 'mock', model: 'mock-writer' },
      { chapterCount: 3 }
    );

    expect(calls).toBe(3);
    expect(novel.chapters.map(chapter => chapter.draft.title)).toEqual(['Chương AI 1', 'Chương AI 2', 'Chương AI 3']);
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
    expect(plan.statements.flatMap(statement => statement.values).some(value => value === '["kiểm soát mỏ kiếm mạch"]')).toBe(true);
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
