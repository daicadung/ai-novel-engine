import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { buildMvpInsertPlan, generateMvpNovel, mapMvpNovelToPersistence } from '../../packages/mvp-pipeline/src';

describe('MVP pipeline persistence (Real DB)', () => {
  let client: Client;
  let dbConnected = false;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.warn('Skipping MVP DB insert test: DATABASE_URL is not set.');
      return;
    }

    client = new Client({ connectionString });
    try {
      await client.connect();
      dbConnected = true;
    } catch {
      console.warn('Skipping MVP DB insert test: Could not connect to Postgres database.');
    }
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
  });

  it('inserts title-only MVP payload in one rollback transaction', async (ctx) => {
    if (!dbConnected) return ctx.skip();

    const ownerId = '00000000-0000-4000-8000-000000000101';
    const novelId = '00000000-0000-4000-8000-000000000102';
    const result = generateMvpNovel('Ta La Kiem De DB Smoke', { chapterCount: 3 });
    const payloads = mapMvpNovelToPersistence(result, { ownerId, novelId });
    const plan = buildMvpInsertPlan(payloads);

    try {
      await client.query('BEGIN;');
      await client.query('INSERT INTO auth.users (id) VALUES ($1) ON CONFLICT DO NOTHING;', [ownerId]);

      for (const statement of plan.statements) {
        await client.query(statement.text, statement.values);
      }

      const { rows: chapters } = await client.query(
        'SELECT count(*)::int AS count FROM chapters WHERE novel_id = $1;',
        [novelId]
      );
      const { rows: events } = await client.query(
        'SELECT count(*)::int AS count FROM story_events WHERE novel_id = $1;',
        [novelId]
      );

      expect(chapters[0].count).toBe(3);
      expect(events[0].count).toBeGreaterThanOrEqual(3);
    } finally {
      await client.query('ROLLBACK;');
    }
  });
});
