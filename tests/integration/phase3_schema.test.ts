import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Phase 3 Schema Migration Structure', () => {
  it('contains expected table creations, policies, and no secrets', () => {
    const migrationPath = path.join(__dirname, '../../supabase/migrations/20260816190600_phase_3_concept_dna.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')

    // 1. Table definitions
    expect(sql).toMatch(/CREATE TABLE concept_candidates/)
    expect(sql).toMatch(/CREATE TABLE story_dna/)
    expect(sql).toMatch(/CREATE TABLE similarity_records/)

    // 2. RLS Enforcement
    expect(sql).toMatch(/ALTER TABLE concept_candidates ENABLE ROW LEVEL SECURITY;/)
    expect(sql).toMatch(/ALTER TABLE story_dna ENABLE ROW LEVEL SECURITY;/)
    expect(sql).toMatch(/ALTER TABLE similarity_records ENABLE ROW LEVEL SECURITY;/)
    
    // Check EXISTS policies for child access
    expect(sql).toContain('EXISTS (SELECT 1 FROM novels WHERE novels.id = concept_candidates.novel_id AND novels.owner_id = auth.uid())')
    expect(sql).toContain('EXISTS (SELECT 1 FROM novels WHERE novels.id = story_dna.novel_id AND novels.owner_id = auth.uid())')

    // 3. Expected columns & constraints
    expect(sql).toContain('raw_payload JSONB')
    expect(sql).toContain('concept_dna JSONB NOT NULL')
    expect(sql).toContain('embedding vector(1536)')
    
    // Check constraints
    expect(sql).toContain("CHECK (status IN ('generated', 'selected', 'rejected', 'modified'))")
    expect(sql).toContain("CHECK (decision IN ('accept', 'modify', 'reject', 'review'))")
    
    // Check indexes
    expect(sql).toContain('CREATE INDEX idx_similarity_records_decision_score ON similarity_records(decision, similarity_score);')

    // 4. Secret exclusion check (CRITICAL)
    const lowerSql = sql.toLowerCase()
    expect(lowerSql).not.toMatch(/\bprompt\b/)
    expect(lowerSql).not.toContain('prompt_text')
    expect(lowerSql).not.toContain('prompt_json')
    expect(lowerSql).not.toMatch(/\bapi_key\b/)
    expect(lowerSql).not.toMatch(/\bsecret\b/)
    expect(lowerSql).not.toContain('access_token')
    expect(lowerSql).not.toContain('refresh_token')
  })
})
