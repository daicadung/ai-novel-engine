import { describe, it, expect } from 'vitest';
import { mapStoryBibleDraftToPersistence } from '../mappers/persistence.mapper';
import { StoryBibleDraft } from '../types';

describe('persistence.mapper', () => {
  const mockDraft: StoryBibleDraft = {
    bible: { premise: 'p', genre: 'g', tone: 't', style_guide: { s: 1 }, rules: { r: 1 } },
    world: { name: 'w', description: 'd', rules: { r: 1 }, history: { h: 1 } },
    locations: [{ name: 'l1', kind: 'k', description: 'd', metadata: {}, parentName: 'w' }],
    factions: [{ name: 'f1', kind: 'k', description: 'd', goals: ['g'], metadata: {} }],
    characters: [
      {
        name: 'c1', role: 'r', description: 'd', personality: { p: 1 }, goals: ['g'], secrets: ['s'], metadata: {},
        initial_state: { status: 'alive', power_state: { p: 1 }, inventory: ['sword'], relationships: { r: 1 }, notes: '', current_location_name: 'l1' }
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
  };

  it('maps correctly and does not include arcs or chapters', () => {
    const result = mapStoryBibleDraftToPersistence(mockDraft, 'novel-123');

    expect(result.story_bibles).toHaveLength(1);
    expect(result.worlds).toHaveLength(1);
    expect(result.locations).toHaveLength(1);
    expect(result.factions).toHaveLength(1);
    expect(result.characters).toHaveLength(1);
    expect(result.character_states).toHaveLength(1);
    expect(result.items).toHaveLength(1);
    expect(result.abilities).toHaveLength(1);
    expect(result.timelines).toHaveLength(1);
    expect(result.story_events).toHaveLength(1);
    expect(result.plot_threads).toHaveLength(1);

    expect(result.locations[0].metadata).toMatchObject({ parent_name_ref: 'w' });
    // Validate arcs/chapters missing
    const res = result as unknown as Record<string, unknown>;
    expect(res.arcs).toBeUndefined();
    expect(res.sub_arcs).toBeUndefined();
    expect(res.chapter_outlines).toBeUndefined();
    expect(res.chapters).toBeUndefined();

    // Exact key shape assertions for specific tables matching Phase 1 schema
    expect(Object.keys(result.character_states[0]).sort()).toEqual(
      ['chapter_number', 'status', 'power_state', 'inventory', 'relationships', 'notes'].sort()
    );
    expect(Object.keys(result.items[0]).sort()).toEqual(
      ['novel_id', 'name', 'kind', 'description', 'state'].sort()
    );
    expect(Object.keys(result.abilities[0]).sort()).toEqual(
      ['novel_id', 'name', 'kind', 'description', 'rules', 'limitations'].sort()
    );
  });
});
