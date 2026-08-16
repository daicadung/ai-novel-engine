import { describe, it, expect } from 'vitest';
import { mapMemoryToCharacterStates, mapMemoryToStoryEvents, mapMemoryToPlotThreads, mapMemoryToItems } from '../mappers/state.mapper';
import { ExtractedMemory } from '../types';

describe('State Mapper', () => {
  const mockMemory: ExtractedMemory = {
    chapter_number: 10,
    character_deltas: [
      { character_name: 'Hero', status: 'alive', location_name: 'City', power_state_changes: { level: 2 }, inventory_changes: { added: ['Sword'] }, notes: 'Found sword' }
    ],
    relationship_deltas: [
      { character_a_name: 'Hero', character_b_name: 'Villain', relationship_change: 'enemies' }
    ],
    location_deltas: [],
    item_deltas: [
      { item_name: 'Sword', new_owner_name: 'Hero', new_location_name: 'City', state_changes: { sharp: true } }
    ],
    plot_thread_deltas: [
      { thread_title: 'Defeat Villain', status: 'active', development_summary: 'Got sword' }
    ],
    story_events: [
      { title: 'Sword Found', description: 'Hero found it', event_type: 'discovery', payload: { item: 'Sword' } }
    ],
    foreshadowing: []
  };

  it('maps characters and merges relationships', () => {
    const chars = mapMemoryToCharacterStates(mockMemory);
    expect(chars['Hero'].chapter_number).toBe(10);
    expect(chars['Hero'].status).toBe('alive');
    expect(chars['Hero'].power_state).toEqual({ level: 2 });
    expect(chars['Hero'].relationships['Villain']).toBe('enemies');
  });

  it('maps story events', () => {
    const events = mapMemoryToStoryEvents(mockMemory);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Sword Found');
    expect(events[0].sequence_number).toBe(0);
    expect(events[0].chapter_number).toBe(10);
  });

  it('maps plot threads', () => {
    const threads = mapMemoryToPlotThreads(mockMemory);
    expect(threads['Defeat Villain'].status).toBe('active');
    expect(threads['Defeat Villain'].description_append).toBe('Got sword');
  });

  it('maps items', () => {
    const items = mapMemoryToItems(mockMemory);
    expect(items['Sword'].state).toEqual({ sharp: true });
    expect(items['Sword'].notes).toContain('Hero');
  });
});
