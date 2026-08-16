import { StoryBibleDraft, ArchitectPersistencePayloads } from '../types';

export function mapStoryBibleDraftToPersistence(draft: StoryBibleDraft, novelId: string): ArchitectPersistencePayloads {
  // ponytail: current ceiling is name-reference payloads only; upgrade path is two-phase insert resolver.

  const story_bibles = [{
    novel_id: novelId,
    premise: draft.bible.premise,
    genre: draft.bible.genre,
    tone: draft.bible.tone,
    style_guide: draft.bible.style_guide,
    rules: draft.bible.rules,
  }];

  const worlds = [{
    novel_id: novelId,
    name: draft.world.name,
    description: draft.world.description,
    rules: draft.world.rules,
    history: draft.world.history,
  }];

  const locations = draft.locations.map(loc => ({
    novel_id: novelId,
    name: loc.name,
    kind: loc.kind,
    description: loc.description,
    metadata: { ...loc.metadata, parent_name_ref: loc.parentName },
  }));

  const factions = draft.factions.map(fac => ({
    novel_id: novelId,
    name: fac.name,
    kind: fac.kind,
    description: fac.description,
    goals: fac.goals,
    metadata: fac.metadata,
  }));

  const characters = draft.characters.map(char => ({
    novel_id: novelId,
    name: char.name,
    role: char.role,
    description: char.description,
    personality: char.personality,
    goals: char.goals,
    secrets: char.secrets,
    metadata: char.metadata,
  }));

  const character_states = draft.characters
    .filter(char => char.initial_state)
    .map(char => ({
      chapter_number: 0,
      status: char.initial_state!.status,
      power_state: char.initial_state!.power_state,
      inventory: char.initial_state!.inventory,
      relationships: char.initial_state!.relationships,
      notes: `[REF: character_name=${char.name}, location_name=${char.initial_state!.current_location_name || ''}] ${char.initial_state!.notes}`,
    }));

  const items = draft.items.map(item => ({
    novel_id: novelId,
    name: item.name,
    kind: item.kind,
    description: item.description,
    state: { 
      ...item.state, 
      owner_character_name_ref: item.owner_character_name || '', 
      location_name_ref: item.location_name || '' 
    },
  }));

  const abilities = draft.abilities.map(ab => ({
    novel_id: novelId,
    name: ab.name,
    kind: ab.kind,
    description: ab.description,
    rules: ab.rules,
    limitations: [
      ...ab.limitations, 
      `[REF: character_name=${ab.character_name || ''}]`
    ],
  }));

  const timelines = [{
    novel_id: novelId,
    name: draft.timeline.name,
    description: draft.timeline.description,
  }];

  const story_events = draft.timeline.events.map(ev => ({
    novel_id: novelId,
    sequence_number: ev.sequence_number,
    title: ev.title,
    description: ev.description,
    event_type: ev.event_type,
    payload: ev.payload,
  }));

  const plot_threads = draft.plot_threads.map(pt => ({
    novel_id: novelId,
    title: pt.title,
    status: pt.status,
    priority: pt.priority,
    description: pt.description,
    metadata: pt.metadata,
  }));

  return {
    story_bibles,
    worlds,
    locations,
    factions,
    characters,
    character_states,
    items,
    abilities,
    timelines,
    story_events,
    plot_threads,
  };
}
