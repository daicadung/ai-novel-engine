import { StoryBibleDraft, WorldDraft, LocationDraft, FactionDraft, CharacterDraft, ItemDraft, AbilityDraft, TimelineEventDraft, PlotThreadDraft, PlotThreadStatus } from '../types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expectString(obj: Record<string, unknown>, key: string, path: string): string {
  if (typeof obj[key] !== 'string') {
    throw new Error(`Invalid StoryBible payload: Missing or invalid string at "${path}.${key}"`);
  }
  return obj[key] as string;
}

function expectOptionalString(obj: Record<string, unknown>, key: string, path: string): string | undefined {
  if (obj[key] === undefined || obj[key] === null) return undefined;
  if (typeof obj[key] !== 'string') {
    throw new Error(`Invalid StoryBible payload: Expected string for optional field "${path}.${key}"`);
  }
  return obj[key] as string;
}

function expectObject(obj: Record<string, unknown>, key: string, path: string): Record<string, unknown> {
  if (!isPlainObject(obj[key])) {
    throw new Error(`Invalid StoryBible payload: Expected plain object at "${path}.${key}"`);
  }
  return obj[key] as Record<string, unknown>;
}

function expectArray(obj: Record<string, unknown>, key: string, path: string): unknown[] {
  if (!Array.isArray(obj[key])) {
    throw new Error(`Invalid StoryBible payload: Expected array at "${path}.${key}"`);
  }
  return obj[key] as unknown[];
}

function expectStringArray(obj: Record<string, unknown>, key: string, path: string): string[] {
  const arr = expectArray(obj, key, path);
  if (!arr.every(item => typeof item === 'string')) {
    throw new Error(`Invalid StoryBible payload: Expected array of strings at "${path}.${key}"`);
  }
  return arr as string[];
}

export function parseStoryBibleDraft(jsonText: string): StoryBibleDraft {
  let parsed: unknown;
  try {
    let cleanText = jsonText.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim();
    }
    parsed = JSON.parse(cleanText);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse StoryBible JSON: ${msg}`);
  }

  if (!isPlainObject(parsed)) {
    throw new Error('Invalid StoryBible payload: Expected top-level plain object.');
  }

  const root = parsed;

  const bibleObj = expectObject(root, 'bible', 'root');
  const bible = {
    premise: expectString(bibleObj, 'premise', 'bible'),
    genre: expectString(bibleObj, 'genre', 'bible'),
    tone: expectString(bibleObj, 'tone', 'bible'),
    style_guide: expectObject(bibleObj, 'style_guide', 'bible'),
    rules: expectObject(bibleObj, 'rules', 'bible'),
  };

  const worldObj = expectObject(root, 'world', 'root');
  const world: WorldDraft = {
    name: expectString(worldObj, 'name', 'world'),
    description: expectString(worldObj, 'description', 'world'),
    rules: expectObject(worldObj, 'rules', 'world'),
    history: expectObject(worldObj, 'history', 'world'),
  };

  const rawLocations = expectArray(root, 'locations', 'root');
  const locations: LocationDraft[] = rawLocations.map((item, idx) => {
    if (!isPlainObject(item)) throw new Error(`Invalid array item at locations[${idx}]`);
    return {
      name: expectString(item, 'name', `locations[${idx}]`),
      kind: expectString(item, 'kind', `locations[${idx}]`),
      description: expectString(item, 'description', `locations[${idx}]`),
      metadata: expectObject(item, 'metadata', `locations[${idx}]`),
      parentName: expectOptionalString(item, 'parentName', `locations[${idx}]`),
    };
  });

  const rawFactions = expectArray(root, 'factions', 'root');
  const factions: FactionDraft[] = rawFactions.map((item, idx) => {
    if (!isPlainObject(item)) throw new Error(`Invalid array item at factions[${idx}]`);
    return {
      name: expectString(item, 'name', `factions[${idx}]`),
      kind: expectString(item, 'kind', `factions[${idx}]`),
      description: expectString(item, 'description', `factions[${idx}]`),
      goals: expectStringArray(item, 'goals', `factions[${idx}]`),
      metadata: expectObject(item, 'metadata', `factions[${idx}]`),
    };
  });

  const rawCharacters = expectArray(root, 'characters', 'root');
  const characters: CharacterDraft[] = rawCharacters.map((item, idx) => {
    if (!isPlainObject(item)) throw new Error(`Invalid array item at characters[${idx}]`);
    
    let initial_state: CharacterDraft['initial_state'];
    if (item.initial_state !== undefined && item.initial_state !== null) {
      const stateObj = expectObject(item, 'initial_state', `characters[${idx}]`);
      initial_state = {
        status: expectString(stateObj, 'status', `characters[${idx}].initial_state`),
        power_state: expectObject(stateObj, 'power_state', `characters[${idx}].initial_state`),
        inventory: expectStringArray(stateObj, 'inventory', `characters[${idx}].initial_state`),
        relationships: expectObject(stateObj, 'relationships', `characters[${idx}].initial_state`),
        notes: expectString(stateObj, 'notes', `characters[${idx}].initial_state`),
        current_location_name: expectOptionalString(stateObj, 'current_location_name', `characters[${idx}].initial_state`),
      };
    }

    return {
      name: expectString(item, 'name', `characters[${idx}]`),
      role: expectString(item, 'role', `characters[${idx}]`),
      description: expectString(item, 'description', `characters[${idx}]`),
      personality: expectObject(item, 'personality', `characters[${idx}]`),
      goals: expectStringArray(item, 'goals', `characters[${idx}]`),
      secrets: expectStringArray(item, 'secrets', `characters[${idx}]`),
      metadata: expectObject(item, 'metadata', `characters[${idx}]`),
      initial_state,
    };
  });

  const rawItems = expectArray(root, 'items', 'root');
  const items: ItemDraft[] = rawItems.map((item, idx) => {
    if (!isPlainObject(item)) throw new Error(`Invalid array item at items[${idx}]`);
    return {
      name: expectString(item, 'name', `items[${idx}]`),
      kind: expectString(item, 'kind', `items[${idx}]`),
      description: expectString(item, 'description', `items[${idx}]`),
      state: expectObject(item, 'state', `items[${idx}]`),
      owner_character_name: expectOptionalString(item, 'owner_character_name', `items[${idx}]`),
      location_name: expectOptionalString(item, 'location_name', `items[${idx}]`),
    };
  });

  const rawAbilities = expectArray(root, 'abilities', 'root');
  const abilities: AbilityDraft[] = rawAbilities.map((item, idx) => {
    if (!isPlainObject(item)) throw new Error(`Invalid array item at abilities[${idx}]`);
    return {
      name: expectString(item, 'name', `abilities[${idx}]`),
      kind: expectString(item, 'kind', `abilities[${idx}]`),
      description: expectString(item, 'description', `abilities[${idx}]`),
      rules: expectStringArray(item, 'rules', `abilities[${idx}]`),
      limitations: expectStringArray(item, 'limitations', `abilities[${idx}]`),
      character_name: expectOptionalString(item, 'character_name', `abilities[${idx}]`),
    };
  });

  const timelineObj = expectObject(root, 'timeline', 'root');
  const rawTimelineEvents = expectArray(timelineObj, 'events', 'timeline');
  const timelineEvents: TimelineEventDraft[] = rawTimelineEvents.map((item, idx) => {
    if (!isPlainObject(item)) throw new Error(`Invalid array item at timeline.events[${idx}]`);
    if (typeof item.sequence_number !== 'number') {
      throw new Error(`Invalid StoryBible payload: Missing or invalid number at "timeline.events[${idx}].sequence_number"`);
    }
    return {
      sequence_number: item.sequence_number,
      title: expectString(item, 'title', `timeline.events[${idx}]`),
      description: expectString(item, 'description', `timeline.events[${idx}]`),
      event_type: expectString(item, 'event_type', `timeline.events[${idx}]`),
      payload: expectObject(item, 'payload', `timeline.events[${idx}]`),
    };
  });

  const timeline = {
    name: expectString(timelineObj, 'name', 'timeline'),
    description: expectString(timelineObj, 'description', 'timeline'),
    events: timelineEvents,
  };

  const rawPlotThreads = expectArray(root, 'plot_threads', 'root');
  const plot_threads: PlotThreadDraft[] = rawPlotThreads.map((item, idx) => {
    if (!isPlainObject(item)) throw new Error(`Invalid array item at plot_threads[${idx}]`);
    
    const status = expectString(item, 'status', `plot_threads[${idx}]`);
    if (!['open', 'active', 'resolved', 'dropped'].includes(status)) {
      throw new Error(`Invalid plot thread status "${status}" at plot_threads[${idx}].status`);
    }

    if (typeof item.priority !== 'number') {
      throw new Error(`Invalid StoryBible payload: Missing or invalid number at "plot_threads[${idx}].priority"`);
    }

    return {
      title: expectString(item, 'title', `plot_threads[${idx}]`),
      status: status as PlotThreadStatus,
      priority: item.priority,
      description: expectString(item, 'description', `plot_threads[${idx}]`),
      metadata: expectObject(item, 'metadata', `plot_threads[${idx}]`),
    };
  });

  return {
    bible,
    world,
    locations,
    factions,
    characters,
    items,
    abilities,
    timeline,
    plot_threads,
  };
}
