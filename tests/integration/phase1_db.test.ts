import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { describeDbError } from './db_error'

describe('Phase 1 DB Tables and RLS (Real)', () => {
  let client: Client
  let dbConnected = false

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      console.warn('Skipping Phase 1 DB tests: DATABASE_URL is not set.')
      return
    }
    client = new Client({ connectionString })
    
    try {
      await client.connect()
      dbConnected = true
    } catch (error) {
      throw new Error(`Could not connect to Postgres database for Phase 1 DB tests: ${describeDbError(error)}`)
    }
  })

  afterAll(async () => {
    if (client) {
      await client.end()
    }
  })

  it('verifies all phase 1 tables exist and have RLS enabled', async (ctx) => {
    if (!dbConnected) return ctx.skip()

    const { rows } = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public';
    `)

    const tables = rows.map(r => r.tablename)
    const rlsMap = new Map(rows.map(r => [r.tablename, r.rowsecurity]))

    const expectedTables = [
      'novels', 'story_bibles', 'worlds', 'locations', 'factions',
      'characters', 'character_states', 'items', 'abilities',
      'timelines', 'story_events', 'plot_threads', 'arcs',
      'sub_arcs', 'chapter_outlines', 'chapters'
    ]

    for (const expected of expectedTables) {
      expect(tables).toContain(expected)
      expect(rlsMap.get(expected)).toBe(true)
    }
  })
})
