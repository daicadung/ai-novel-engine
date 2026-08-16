import { describe, it, expect } from 'vitest';
import { parseStoryBibleDraft } from '../parsers/bible.parser';

describe('bible.parser', () => {
  const validDraftJson = JSON.stringify({
    bible: { premise: 'p', genre: 'g', tone: 't', style_guide: { s: 1 }, rules: { r: 1 } },
    world: { name: 'w', description: 'd', rules: { r: 1 }, history: { h: 1 } },
    locations: [{ name: 'l1', kind: 'k', description: 'd', metadata: {}, parentName: 'w' }],
    factions: [{ name: 'f1', kind: 'k', description: 'd', goals: ['g'], metadata: {} }],
    characters: [
      {
        name: 'c1', role: 'r', description: 'd', personality: { p: 1 }, goals: ['g'], secrets: ['s'], metadata: {},
        initial_state: { status: 'alive', power_state: { ps: 1 }, inventory: ['sword'], relationships: { r: 1 }, notes: '', current_location_name: 'l1' }
      }
    ],
    items: [{ name: 'i1', kind: 'k', description: 'd', state: { s: 1 }, owner_character_name: 'c1' }],
    abilities: [{ name: 'a1', kind: 'k', description: 'd', rules: ['r'], limitations: ['l'], character_name: 'c1' }],
    timeline: {
      name: 'tl', description: 'd',
      events: [{ sequence_number: 1, title: 't', description: 'd', event_type: 'e', payload: {} }]
    },
    plot_threads: [
      { title: 'pt1', status: 'open', priority: 1, description: 'd', metadata: {} }
    ]
  });

  it('parses valid JSON', () => {
    const draft = parseStoryBibleDraft(validDraftJson);
    expect(draft.bible.premise).toBe('p');
    expect(draft.plot_threads[0].status).toBe('open');
  });

  it('rejects invalid JSON', () => {
    expect(() => parseStoryBibleDraft('{ invalid ')).toThrow(/Failed to parse/);
  });

  it('rejects missing top-level section', () => {
    const missingWorld = JSON.parse(validDraftJson);
    delete missingWorld.world;
    expect(() => parseStoryBibleDraft(JSON.stringify(missingWorld))).toThrow('Invalid StoryBible payload: Expected plain object at "root.world"');
  });

  it('rejects array instead of object', () => {
    const invalidWorld = JSON.parse(validDraftJson);
    invalidWorld.world = [];
    expect(() => parseStoryBibleDraft(JSON.stringify(invalidWorld))).toThrow('Invalid StoryBible payload: Expected plain object at "root.world"');
  });

  it('rejects invalid plot_thread status', () => {
    const invalidStatus = JSON.parse(validDraftJson);
    invalidStatus.plot_threads[0].status = 'unknown_status';
    expect(() => parseStoryBibleDraft(JSON.stringify(invalidStatus))).toThrow('Invalid plot thread status "unknown_status" at plot_threads[0].status');
  });
});
