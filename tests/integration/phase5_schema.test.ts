import { describe, it, expect } from 'vitest';
import { LongformPlanner } from '../../packages/longform-planner/src/core/planner';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 5 Integration & Scope Validation', () => {
  it('does not define any new migrations for Phase 5', () => {
    const migrationsDir = path.join(__dirname, '../../supabase/migrations');
    const files = fs.readdirSync(migrationsDir);
    const phase5Migrations = files.filter(f => f.includes('phase_5'));
    expect(phase5Migrations).toHaveLength(0);
  });

  it('proves no real LLM calls or APIs are used by planner', () => {
    const plannerPath = path.join(__dirname, '../../packages/longform-planner/src/core/planner.ts');
    const plannerSrc = fs.readFileSync(plannerPath, 'utf8');
    
    // Explicitly check for forbidden words
    expect(plannerSrc).not.toMatch(/fetch\(/);
    expect(plannerSrc).not.toMatch(/axios/);
    expect(plannerSrc).not.toMatch(/openai/i);
    expect(plannerSrc).not.toMatch(/anthropic/i);
    expect(plannerSrc).not.toMatch(/OPENAI_API_KEY/i);
  });

  it('can be imported and run a valid plan', () => {
    const planner = new LongformPlanner();
    const plan = planner.plan({
      title: 'Title',
      bible: {
        bible: { premise: 'Premise', genre: '', tone: '', style_guide: {}, rules: {} },
        world: { name: 'World', description: 'World desc', rules: {}, history: {} },
        locations: [],
        factions: [],
        characters: [{ name: 'Char', role: '', description: '', personality: {}, goals: [], secrets: [], metadata: {} }],
        items: [],
        abilities: [],
        timeline: { name: '', description: '', events: [] },
        plot_threads: [{ title: 'Thread', status: 'open', priority: 1, description: 'Desc', metadata: {} }]
      }
    }, { targetChapters: 10, seed: 'integration' });

    expect(plan.arcs.length).toBeGreaterThan(0);
    expect(plan.chapter_outlines).toHaveLength(10);
  });
});
