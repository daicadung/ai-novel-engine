import { ExtractedMemory } from '../types';
// ponytail: Current ceiling is payload mapping with unresolved string references (names) 
// instead of UUIDs. The upgrade path is a DB resolver transaction to swap names for UUIDs.

export interface CharacterStatePayload {
  chapter_number: number;
  status?: string;
  power_state: Record<string, unknown>;
  inventory: unknown[];
  relationships: Record<string, unknown>;
  notes: string;
}

export interface StoryEventPayload {
  chapter_number: number;
  sequence_number: number; // to be determined by resolver
  title: string;
  description: string;
  event_type: string;
  payload: Record<string, unknown>;
}

export interface PlotThreadUpdatePayload {
  status: 'open' | 'active' | 'resolved' | 'dropped';
  description_append: string;
}

export interface ItemUpdatePayload {
  state: Record<string, unknown>;
  notes: string;
}

export function mapMemoryToCharacterStates(memory: ExtractedMemory): Record<string, CharacterStatePayload> {
  const result: Record<string, CharacterStatePayload> = {};

  // Initialize from character deltas
  for (const delta of memory.character_deltas) {
    result[delta.character_name] = {
      chapter_number: memory.chapter_number,
      status: delta.status,
      power_state: delta.power_state_changes || {},
      inventory: delta.inventory_changes ? [delta.inventory_changes] : [],
      relationships: {},
      notes: `Location: ${delta.location_name || 'unknown'}. ${delta.notes || ''}`
    };
  }

  // Merge relationships
  for (const rel of memory.relationship_deltas) {
    if (!result[rel.character_a_name]) {
      result[rel.character_a_name] = {
        chapter_number: memory.chapter_number,
        power_state: {},
        inventory: [],
        relationships: {},
        notes: ''
      };
    }
    result[rel.character_a_name].relationships[rel.character_b_name] = rel.relationship_change;
  }

  return result;
}

export function mapMemoryToStoryEvents(memory: ExtractedMemory): StoryEventPayload[] {
  return memory.story_events.map((ev, idx) => ({
    chapter_number: memory.chapter_number,
    sequence_number: idx,
    title: ev.title,
    description: ev.description,
    event_type: ev.event_type || 'chapter_event',
    payload: ev.payload || {}
  }));
}

export function mapMemoryToPlotThreads(memory: ExtractedMemory): Record<string, PlotThreadUpdatePayload> {
  const result: Record<string, PlotThreadUpdatePayload> = {};
  for (const pt of memory.plot_thread_deltas) {
    result[pt.thread_title] = {
      status: pt.status || 'active',
      description_append: pt.development_summary || ''
    };
  }
  return result;
}

export function mapMemoryToItems(memory: ExtractedMemory): Record<string, ItemUpdatePayload> {
  const result: Record<string, ItemUpdatePayload> = {};
  for (const item of memory.item_deltas) {
    result[item.item_name] = {
      state: item.state_changes || {},
      notes: `New Owner: ${item.new_owner_name || 'N/A'}. New Location: ${item.new_location_name || 'N/A'}`
    };
  }
  return result;
}
