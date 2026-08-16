import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'crypto'

describe('Phase 1 RLS Ownership (Real)', () => {
  let client: Client
  let dbConnected = false

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
    client = new Client({ connectionString })
    
    try {
      await client.connect()
      dbConnected = true
    } catch (e) {
      console.warn('Skipping Phase 1 RLS tests: Could not connect to Postgres database.')
    }
  })

  afterAll(async () => {
    if (client) {
      await client.end()
    }
  })

  it('proves user A cannot read or write user Bs novels and characters', async (ctx) => {
    if (!dbConnected) return ctx.skip()
    
    const userA_id = randomUUID()
    const userB_id = randomUUID()
    const novelB_id = randomUUID()
    const charB_id = randomUUID()

    try {
      await client.query('BEGIN;')

      // Seed auth.users for User A and B
      await client.query(
        'INSERT INTO auth.users (id) VALUES ($1), ($2) ON CONFLICT DO NOTHING;',
        [userA_id, userB_id]
      )

      // Seed a novel and character for User B
      await client.query(
        'INSERT INTO novels (id, owner_id, title) VALUES ($1, $2, $3);',
        [novelB_id, userB_id, 'User B Novel']
      )
      
      await client.query(
        'INSERT INTO characters (id, novel_id, name) VALUES ($1, $2, $3);',
        [charB_id, novelB_id, 'User B Character']
      )

      // Simulate User A
      await client.query('SET LOCAL ROLE authenticated;')
      await client.query(
        "SELECT set_config('request.jwt.claims', $1, true);",
        [JSON.stringify({ sub: userA_id, role: 'authenticated' })]
      )

      // Read novel
      const { rows: novels } = await client.query('SELECT * FROM novels WHERE owner_id = $1;', [userB_id])
      expect(novels.length).toBe(0)

      // Read character
      const { rows: chars } = await client.query('SELECT * FROM characters WHERE id = $1;', [charB_id])
      expect(chars.length).toBe(0)

      // Write character (should fail)
      try {
        await client.query(
          'INSERT INTO characters (id, novel_id, name) VALUES ($1, $2, $3);',
          [randomUUID(), novelB_id, 'Hacked Character']
        )
        expect(true).toBe(false)
      } catch (error: any) {
        // Postgres error 42501: insufficient_privilege (RLS)
        expect(error.code).toBe('42501')
      }

    } finally {
      await client.query('ROLLBACK;')
    }
  })
})
