import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Phase 1 Schema Migration Structure', () => {
  it('contains expected table creations, constraints and RLS', () => {
    // Read the latest phase 1 migration file
    const migrationPath = path.join(__dirname, '../../supabase/migrations/20260816183500_phase_1_core_domain.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')

    const expectedTables = [
      'novels', 'story_bibles', 'worlds', 'locations', 'factions',
      'characters', 'character_states', 'items', 'abilities',
      'timelines', 'story_events', 'plot_threads', 'arcs',
      'sub_arcs', 'chapter_outlines', 'chapters'
    ]

    for (const table of expectedTables) {
      // Basic table check
      expect(sql).toMatch(new RegExp(`CREATE TABLE ${table}`))
      // RLS check
      expect(sql).toMatch(new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`))
      // Trigger check
      expect(sql).toMatch(new RegExp(`CREATE TRIGGER update_${table}_modtime`))
    }

    // Check unique constraints for composite keys
    expect(sql).toContain('UNIQUE(novel_id, arc_number)')
    expect(sql).toContain('UNIQUE(arc_id, sub_arc_number)')
    expect(sql).toContain('UNIQUE(novel_id, chapter_number)')

    // Check specific required additional indexes
    const expectedIndexes = [
      'idx_novels_status',
      'idx_novels_owner_id_status',
      'idx_story_events_timeline_id',
      'idx_chapters_outline_id'
    ]
    for (const idx of expectedIndexes) {
      expect(sql).toContain(`CREATE INDEX ${idx}`)
    }
  })
})
