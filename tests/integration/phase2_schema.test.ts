import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Phase 2 Schema Migration Structure', () => {
  it('contains expected table creations, policies, and no secrets', () => {
    const migrationPath = path.join(__dirname, '../../supabase/migrations/20260816184600_phase_2_llm_gateway.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')

    // 1. Table definitions
    expect(sql).toMatch(/CREATE TABLE model_configs/)
    expect(sql).toMatch(/CREATE TABLE llm_requests/)

    // 2. RLS Enforcement
    expect(sql).toMatch(/ALTER TABLE model_configs ENABLE ROW LEVEL SECURITY;/)
    expect(sql).toMatch(/ALTER TABLE llm_requests ENABLE ROW LEVEL SECURITY;/)

    // 3. Expected columns
    expect(sql).toContain('estimated_cost NUMERIC')
    expect(sql).toContain('currency TEXT')
    expect(sql).toContain('error_message TEXT')

    // 4. Secret exclusion check (CRITICAL)
    const lowerSql = sql.toLowerCase()
    expect(lowerSql).not.toContain('api_key')
    expect(lowerSql).not.toContain('secret')
    expect(lowerSql).not.toContain('token_content')
    expect(lowerSql).not.toContain('prompt_content')
    
    // 5. Check global read policy exists
    expect(sql).toContain('owner_id IS NULL')
  })
})
