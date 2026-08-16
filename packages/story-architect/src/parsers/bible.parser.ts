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

function safeString(obj: Record<string, unknown>, key: string, fallback = ''): string {
  return typeof obj[key] === 'string' ? obj[key] as string : fallback;
}

function safeObject(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  return isPlainObject(obj[key]) ? obj[key] as Record<string, unknown> : {};
}

function safeStringArray(obj: Record<string, unknown>, key: string): string[] {
  if (!Array.isArray(obj[key])) return [];
  return (obj[key] as unknown[]).filter(x => typeof x === 'string') as string[];
}

function safeArray(obj: Record<string, unknown>, key: string): unknown[] {
  return Array.isArray(obj[key]) ? obj[key] as unknown[] : [];
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

  // Use safe helpers so LLM output that deviates slightly doesn't crash the parser
  const bibleObj = safeObject(root, 'bible');
  const bible = {
    premise: safeString(bibleObj, 'premise') || safeString(root, 'premise', 'No premise'),
    genre: safeString(bibleObj, 'genre') || safeString(root, 'genre', 'fantasy'),
    tone: safeString(bibleObj, 'tone', 'neutral'),
    style_guide: safeObject(bibleObj, 'style_guide'),
    rules: safeObject(bibleObj, 'rules'),
  };

  const worldObj = safeObject(root, 'world');
  const world: WorldDraft = {
    name: safeString(worldObj, 'name', 'Unknown World'),
    description: safeString(worldObj, 'description', ''),
    rules: safeObject(worldObj, 'rules'),
    history: safeObject(worldObj, 'history'),
  };

  const rawLocations = safeArray(root, 'locations');
  const locations: LocationDraft[] = rawLocations.filter(isPlainObject).map((item, idx) => ({
    name: safeString(item, 'name', `Location ${idx}`),
    kind: safeString(item, 'kind', 'place'),
    description: safeString(item, 'description', ''),
    metadata: safeObject(item, 'metadata'),
    parentName: typeof item.parentName === 'string' ? item.parentName : undefined,
  }));

  const rawFactions = safeArray(root, 'factions');
  const factions: FactionDraft[] = rawFactions.filter(isPlainObject).map((item, idx) => ({
    name: safeString(item, 'name', `Faction ${idx}`),
    kind: safeString(item, 'kind', 'group'),
    description: safeString(item, 'description', ''),
    goals: safeStringArray(item, 'goals'),
    metadata: safeObject(item, 'metadata'),
  }));

  const rawCharacters = safeArray(root, 'characters');
  const characters: CharacterDraft[] = rawCharacters.filter(isPlainObject).map((item, idx) => {
    let initial_state: CharacterDraft['initial_state'];
    if (item.initial_state !== undefined && item.initial_state !== null && isPlainObject(item.initial_state)) {
      const stateObj = item.initial_state as Record<string, unknown>;
      initial_state = {
        status: safeString(stateObj, 'status', 'alive'),
        power_state: safeObject(stateObj, 'power_state'),
        inventory: safeStringArray(stateObj, 'inventory'),
        relationships: safeObject(stateObj, 'relationships'),
        notes: safeString(stateObj, 'notes', ''),
        current_location_name: typeof stateObj.current_location_name === 'string' ? stateObj.current_location_name : undefined,
      };
    }
    return {
      name: safeString(item, 'name', `Character ${idx}`),
      role: safeString(item, 'role', 'supporting'),
      description: safeString(item, 'description', ''),
      personality: safeObject(item, 'personality'),
      goals: safeStringArray(item, 'goals'),
      secrets: safeStringArray(item, 'secrets'),
      metadata: safeObject(item, 'metadata'),
      initial_state,
    };
  });

  const rawItems = safeArray(root, 'items');
  const items: ItemDraft[] = rawItems.filter(isPlainObject).map((item, idx) => ({
    name: safeString(item, 'name', `Item ${idx}`),
    kind: safeString(item, 'kind', 'object'),
    description: safeString(item, 'description', ''),
    state: safeObject(item, 'state'),
    owner_character_name: typeof item.owner_character_name === 'string' ? item.owner_character_name : undefined,
    location_name: typeof item.location_name === 'string' ? item.location_name : undefined,
  }));

  const rawAbilities = safeArray(root, 'abilities');
  const abilities: AbilityDraft[] = rawAbilities.filter(isPlainObject).map((item, idx) => ({
    name: safeString(item, 'name', `Ability ${idx}`),
    kind: safeString(item, 'kind', 'skill'),
    description: safeString(item, 'description', ''),
    rules: safeStringArray(item, 'rules'),
    limitations: safeStringArray(item, 'limitations'),
    character_name: typeof item.character_name === 'string' ? item.character_name : undefined,
  }));

  const timelineObj = safeObject(root, 'timeline');
  const rawTimelineEvents = safeArray(timelineObj, 'events');
  const timelineEvents: TimelineEventDraft[] = rawTimelineEvents.filter(isPlainObject).map((item, idx) => ({
    sequence_number: typeof item.sequence_number === 'number' ? item.sequence_number : idx + 1,
    title: safeString(item, 'title', `Event ${idx + 1}`),
    description: safeString(item, 'description', ''),
    event_type: safeString(item, 'event_type', 'event'),
    payload: safeObject(item, 'payload'),
  }));

  const timeline = {
    name: safeString(timelineObj, 'name', 'Main Timeline'),
    description: safeString(timelineObj, 'description', ''),
    events: timelineEvents,
  };

  const rawPlotThreads = safeArray(root, 'plot_threads');
  const VALID_STATUSES: PlotThreadStatus[] = ['open', 'active', 'resolved', 'dropped'];
  const plot_threads: PlotThreadDraft[] = rawPlotThreads.filter(isPlainObject).map((item, idx) => {
    const rawStatus = safeString(item, 'status', 'open');
    const status: PlotThreadStatus = VALID_STATUSES.includes(rawStatus as PlotThreadStatus)
      ? (rawStatus as PlotThreadStatus)
      : 'open';
    return {
      title: safeString(item, 'title', `Plot Thread ${idx}`),
      status,
      priority: typeof item.priority === 'number' ? item.priority : idx + 1,
      description: safeString(item, 'description', ''),
      metadata: safeObject(item, 'metadata'),
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
