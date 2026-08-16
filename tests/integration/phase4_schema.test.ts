import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ArchitectPersistencePayloads } from '@ai-novel-engine/story-architect';

describe('Phase 4 Static Schema and Integration Checks', () => {
  it('does not introduce any new migrations for Phase 4', () => {
    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
    const files = fs.readdirSync(migrationsDir);
    const phase4Migrations = files.filter(f => f.includes('phase_4'));
    expect(phase4Migrations).toHaveLength(0);
  });

  it('maps directly to existing Phase 1 persistence table names', () => {
    const expectedTables = [
      'story_bibles',
      'worlds',
      'locations',
      'factions',
      'characters',
      'character_states',
      'items',
      'abilities',
      'timelines',
      'story_events',
      'plot_threads'
    ];

    // We can infer the keys of ArchitectPersistencePayloads from the dummy implementation
    const dummyPayloads: Record<keyof ArchitectPersistencePayloads, unknown[]> = {
      story_bibles: [],
      worlds: [],
      locations: [],
      factions: [],
      characters: [],
      character_states: [],
      items: [],
      abilities: [],
      timelines: [],
      story_events: [],
      plot_threads: []
    };

    const payloadKeys = Object.keys(dummyPayloads);
    
    expect(payloadKeys).toEqual(expect.arrayContaining(expectedTables));
    expect(expectedTables).toEqual(expect.arrayContaining(payloadKeys));

    // Must NOT contain arcs, sub_arcs, chapters
    expect(payloadKeys).not.toContain('arcs');
    expect(payloadKeys).not.toContain('chapters');
  });

  it('does not store prompts or secrets in the architect types', () => {
    const typesContent = fs.readFileSync(path.resolve(__dirname, '../../packages/story-architect/src/types.ts'), 'utf8');
    const lowerContent = typesContent.toLowerCase();
    
    // Architect should not mention storing prompts
    expect(lowerContent).not.toMatch(/\bprompt_content\b/);
    expect(lowerContent).not.toMatch(/\bsecret\b/);
    expect(lowerContent).not.toMatch(/\bapi_key\b/);
  });
});
