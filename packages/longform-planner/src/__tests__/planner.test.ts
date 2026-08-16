import { describe, it, expect } from 'vitest';
import { LongformPlanner } from '../core/planner';
import { LongformPlannerInput } from '../types';

describe('LongformPlanner', () => {
  const dummyInput: LongformPlannerInput = {
    title: 'Test Novel',
    bible: {
      bible: { premise: 'Valid premise', genre: '', tone: '', style_guide: {}, rules: {} },
      world: { name: 'Valid world', description: 'Valid world desc', rules: {}, history: {} },
      locations: [],
      factions: [],
      characters: [{ name: 'Valid char', role: '', description: '', personality: {}, goals: [], secrets: [], metadata: {} }],
      items: [],
      abilities: [],
      timeline: {
        name: '', description: '',
        events: [
          { sequence_number: 1, title: 'Ev1', description: '', event_type: '', payload: {} },
          { sequence_number: 2, title: 'Ev2', description: '', event_type: '', payload: {} }
        ]
      },
      plot_threads: [
        { title: 'PT1', status: 'open', priority: 1, description: 'Valid desc', metadata: {} }
      ]
    }
  };

  it('generates a 300 chapter deterministic plan correctly', () => {
    const planner = new LongformPlanner();
    const config = { targetChapters: 300, seed: 'test-seed-123' };
    const plan = planner.plan(dummyInput, config);

    expect(plan.chapter_outlines).toHaveLength(300);
    expect(plan.arcs.length).toBeGreaterThan(0);
    expect(plan.sub_arcs.length).toBeGreaterThan(0);

    // Verify ordering and no gaps
    let expectedChapter = 1;
    for (const chap of plan.chapter_outlines) {
      expect(chap.chapter_number).toBe(expectedChapter);
      expectedChapter++;
    }
    
    // Verify threads and timelines are preserved and seeded
    expect(plan.plot_threads).toHaveLength(1);
    expect(typeof plan.plot_threads[0].metadata.planned_resolution_chapter).toBe('number');

    expect(plan.timelines).toHaveLength(1);
    expect(plan.story_events).toHaveLength(2);

    // Verify progression beats (LONGFORM_PHASES) appear
    const subArcPhases = new Set(plan.sub_arcs.map(s => s.metadata.phase));
    expect(subArcPhases.has('setup')).toBe(true);
    expect(subArcPhases.has('escalation')).toBe(true);
    expect(subArcPhases.has('climax')).toBe(true);
    expect(subArcPhases.has('fallout')).toBe(true);
  });

  it('produces identical output for identical seed', () => {
    const planner = new LongformPlanner();
    const plan1 = planner.plan(dummyInput, { targetChapters: 100, seed: 42 });
    const plan2 = planner.plan(dummyInput, { targetChapters: 100, seed: 42 });

    expect(plan1).toEqual(plan2);
  });

  it('produces different output for different seed', () => {
    const planner = new LongformPlanner();
    const plan1 = planner.plan(dummyInput, { targetChapters: 100, seed: 42 });
    const plan2 = planner.plan(dummyInput, { targetChapters: 100, seed: 43 });

    // Timelines or plot threads random assigned chapter should differ, 
    // or arc chunk sizes should differ.
    expect(plan1).not.toEqual(plan2);
  });

  it('validates empty title', () => {
    const planner = new LongformPlanner();
    expect(() => planner.plan({ ...dummyInput, title: '' }, { targetChapters: 100 }))
      .toThrow('Validation Error: Title must not be empty.');
  });

  it('validates invalid target chapters', () => {
    const planner = new LongformPlanner();
    expect(() => planner.plan(dummyInput, { targetChapters: 0 }))
      .toThrow('Validation Error: targetChapters must be greater than 0.');
  });

  it('validates empty bible premise', () => {
    const planner = new LongformPlanner();
    const badInput = JSON.parse(JSON.stringify(dummyInput));
    badInput.bible.bible.premise = '';
    expect(() => planner.plan(badInput, { targetChapters: 10 })).toThrow(/Bible premise must not be empty/);
  });

  it('validates empty world name', () => {
    const planner = new LongformPlanner();
    const badInput = JSON.parse(JSON.stringify(dummyInput));
    badInput.bible.world.name = '';
    expect(() => planner.plan(badInput, { targetChapters: 10 })).toThrow(/World name and description must not be empty/);
  });

  it('validates missing characters', () => {
    const planner = new LongformPlanner();
    const badInput = JSON.parse(JSON.stringify(dummyInput));
    badInput.bible.characters = [];
    expect(() => planner.plan(badInput, { targetChapters: 10 })).toThrow(/At least one character/);
  });

  it('validates invalid plot thread', () => {
    const planner = new LongformPlanner();
    const badInput = JSON.parse(JSON.stringify(dummyInput));
    badInput.bible.plot_threads[0].title = '';
    expect(() => planner.plan(badInput, { targetChapters: 10 })).toThrow(/Plot threads must have non-empty title/);
  });
});
