import { createHash } from 'crypto';
import { mapChapterDraftToPersistence } from '@ai-novel-engine/chapter-writer';
import { mapLongformPlanToPersistence } from '@ai-novel-engine/longform-planner';
import {
  mapMemoryToCharacterStates,
  mapMemoryToItems,
  mapMemoryToPlotThreads,
  mapMemoryToStoryEvents
} from '@ai-novel-engine/memory-continuity';
import { mapStoryBibleDraftToPersistence } from '@ai-novel-engine/story-architect';
import { MvpNovelResult } from './pipeline';

export interface MvpPersistencePayloads {
  novels: Record<string, unknown>[];
  concept_candidates: Record<string, unknown>[];
  story_dna: Record<string, unknown>[];
  story_bibles: Record<string, unknown>[];
  worlds: Record<string, unknown>[];
  locations: Record<string, unknown>[];
  factions: Record<string, unknown>[];
  characters: Record<string, unknown>[];
  character_states: Record<string, unknown>[];
  items: Record<string, unknown>[];
  abilities: Record<string, unknown>[];
  timelines: Record<string, unknown>[];
  story_events: Record<string, unknown>[];
  plot_threads: Record<string, unknown>[];
  arcs: Record<string, unknown>[];
  sub_arcs: Record<string, unknown>[];
  chapter_outlines: Record<string, unknown>[];
  chapters: Record<string, unknown>[];
  plot_thread_updates: Record<string, unknown>[];
  item_updates: Record<string, unknown>[];
}

export interface SqlStatement {
  text: string;
  values: unknown[];
}

export interface SqlInsertPlan {
  statements: SqlStatement[];
}

const INSERT_TABLE_ORDER = [
  'novels',
  'concept_candidates',
  'story_dna',
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
  'plot_threads',
  'arcs',
  'sub_arcs',
  'chapter_outlines',
  'chapters'
] as const;

export function mapMvpNovelToPersistence(
  result: MvpNovelResult,
  ids: { ownerId: string; novelId: string; conceptCandidateId?: string }
): MvpPersistencePayloads {
  if (!ids.ownerId.trim() || !ids.novelId.trim()) {
    throw new Error('ownerId and novelId are required.');
  }

  const conceptCandidateId = ids.conceptCandidateId ?? deterministicId(ids.novelId, 'concept_candidates', '1');
  const architect = mapStoryBibleDraftToPersistence(result.bible, ids.novelId);
  const longform = mapLongformPlanToPersistence(result.plan, ids.novelId);
  const locationIds = new Map(result.bible.locations.map(location => [
    location.name,
    deterministicId(ids.novelId, 'locations', location.name)
  ]));
  const characterIds = new Map(result.bible.characters.map(character => [
    character.name,
    deterministicId(ids.novelId, 'characters', character.name)
  ]));
  const arcIds = new Map(result.plan.arcs.map(arc => [
    arc.id,
    deterministicId(ids.novelId, 'arcs', arc.id)
  ]));
  const subArcIds = new Map(result.plan.sub_arcs.map(subArc => [
    subArc.id,
    deterministicId(ids.novelId, 'sub_arcs', subArc.id)
  ]));
  const outlineIds = new Map(result.plan.chapter_outlines.map(outline => [
    outline.id,
    deterministicId(ids.novelId, 'chapter_outlines', outline.id)
  ]));
  const timelineId = deterministicId(ids.novelId, 'timelines', result.bible.timeline.name);
  const chapterRows = result.chapters.map((chapter, index) => {
    const outline = result.plan.chapter_outlines[index];
    const row = mapChapterDraftToPersistence(
      chapter.draft,
      ids.novelId,
      outline ? outlineIds.get(outline.id) ?? null : null,
      chapter.memory.chapter_number
    );
    return {
      ...row,
      id: deterministicId(ids.novelId, 'chapters', String(chapter.memory.chapter_number))
    };
  });
  const memoryCharacterStates = result.chapters.flatMap(chapter =>
    Object.entries(mapMemoryToCharacterStates(chapter.memory)).map(([characterName, payload]) => ({
      ...payload,
      id: deterministicId(ids.novelId, 'character_states', `${characterName}:${payload.chapter_number}`),
      character_id: characterIds.get(characterName) ?? deterministicId(ids.novelId, 'characters', characterName),
      location_id: firstLocationId(locationIds),
      notes: `[REF: character_name=${characterName}] ${payload.notes}`
    }))
  );
  const memoryStoryEvents = result.chapters.flatMap(chapter =>
    mapMemoryToStoryEvents(chapter.memory).map(event => ({
      novel_id: ids.novelId,
      ...event
    }))
  );
  const plotThreadUpdates = result.chapters.map(chapter => mapMemoryToPlotThreads(chapter.memory));
  const itemUpdates = result.chapters.map(chapter => mapMemoryToItems(chapter.memory));

  return {
    novels: [{
      id: ids.novelId,
      owner_id: ids.ownerId,
      title: result.title,
      slug: slugify(result.title),
      status: 'active',
      language: 'vi',
      target_chapter_count: result.plan.chapter_outlines.length,
      metadata: { pipeline: 'mvp-pipeline' }
    }],
    concept_candidates: [{
      id: conceptCandidateId,
      owner_id: ids.ownerId,
      novel_id: ids.novelId,
      source_title: result.title,
      candidate_number: 1,
      title: result.concept.title,
      premise: result.concept.premise,
      genre: result.concept.genre,
      setting: result.concept.setting,
      protagonist_archetype: result.concept.protagonist_archetype,
      theme: result.concept.theme,
      conflict: result.concept.conflict,
      progression_model: result.concept.progression_model,
      power_system: result.concept.power_system,
      narrative_structure: result.concept.narrative_structure,
      ending_direction: result.concept.ending_direction,
      raw_payload: result.concept,
      status: 'selected'
    }],
    story_dna: [{
      id: deterministicId(ids.novelId, 'story_dna', '1'),
      owner_id: ids.ownerId,
      novel_id: ids.novelId,
      concept_candidate_id: conceptCandidateId,
      dna_version: 1,
      ...result.dna
    }],
    story_bibles: architect.story_bibles.map((row, index) => ({
      ...row,
      id: deterministicId(ids.novelId, 'story_bibles', String(index + 1))
    })),
    worlds: architect.worlds.map((row, index) => ({
      ...row,
      id: deterministicId(ids.novelId, 'worlds', String(index + 1))
    })),
    locations: architect.locations.map((row) => ({
      ...row,
      id: locationIds.get(String(row.name)),
      parent_location_id: typeof row.metadata === 'object' && row.metadata && 'parent_name_ref' in row.metadata
        ? locationIds.get(String(row.metadata.parent_name_ref)) ?? null
        : null
    })),
    factions: architect.factions.map((row) => ({
      ...row,
      id: deterministicId(ids.novelId, 'factions', String(row.name))
    })),
    characters: architect.characters.map((row) => ({
      ...row,
      id: characterIds.get(String(row.name))
    })),
    character_states: [
      ...result.bible.characters.flatMap(character => character.initial_state ? [{
        id: deterministicId(ids.novelId, 'character_states', `${character.name}:0`),
        character_id: characterIds.get(character.name),
        chapter_number: 0,
        location_id: character.initial_state.current_location_name
          ? locationIds.get(character.initial_state.current_location_name) ?? null
          : null,
        status: character.initial_state.status,
        power_state: character.initial_state.power_state,
        inventory: character.initial_state.inventory,
        relationships: character.initial_state.relationships,
        notes: character.initial_state.notes
      }] : []),
      ...memoryCharacterStates
    ],
    items: architect.items.map((row) => {
      const source = result.bible.items.find(item => item.name === row.name);
      return {
        ...row,
        id: deterministicId(ids.novelId, 'items', String(row.name)),
        owner_character_id: source?.owner_character_name ? characterIds.get(source.owner_character_name) ?? null : null,
        location_id: source?.location_name ? locationIds.get(source.location_name) ?? null : null
      };
    }),
    abilities: architect.abilities.map((row) => {
      const source = result.bible.abilities.find(ability => ability.name === row.name);
      return {
        ...row,
        id: deterministicId(ids.novelId, 'abilities', String(row.name)),
        character_id: source?.character_name ? characterIds.get(source.character_name) ?? null : null
      };
    }),
    timelines: architect.timelines.map((row) => ({
      ...row,
      id: timelineId
    })),
    story_events: [
      ...architect.story_events.map((row, index) => ({
        ...row,
        id: deterministicId(ids.novelId, 'story_events', `bible:${index}`),
        timeline_id: timelineId
      })),
      ...longform.story_events.map((row, index) => ({
        ...row,
        id: deterministicId(ids.novelId, 'story_events', `plan:${index}`),
        timeline_id: timelineId
      })),
      ...memoryStoryEvents.map((row, index) => ({
        ...row,
        id: deterministicId(ids.novelId, 'story_events', `memory:${index}`),
        timeline_id: timelineId,
        sequence_number: 10_000 + index
      }))
    ],
    plot_threads: [...architect.plot_threads, ...longform.plot_threads],
    arcs: longform.arcs.map((row, index) => ({
      ...row,
      id: arcIds.get(result.plan.arcs[index]?.id ?? String(index))
    })),
    sub_arcs: longform.sub_arcs.map((row, index) => {
      const source = result.plan.sub_arcs[index];
      return {
        ...row,
        id: source ? subArcIds.get(source.id) : deterministicId(ids.novelId, 'sub_arcs', String(index)),
        arc_id: source ? arcIds.get(source.arc_id) : row.arc_id
      };
    }),
    chapter_outlines: longform.chapter_outlines.map((row, index) => {
      const source = result.plan.chapter_outlines[index];
      return {
        ...row,
        id: source ? outlineIds.get(source.id) : deterministicId(ids.novelId, 'chapter_outlines', String(index)),
        arc_id: source ? arcIds.get(source.arc_id) ?? null : row.arc_id,
        sub_arc_id: source ? subArcIds.get(source.sub_arc_id) ?? null : row.sub_arc_id
      };
    }),
    chapters: chapterRows,
    plot_thread_updates: plotThreadUpdates,
    item_updates: itemUpdates
  };
}

export function buildMvpInsertPlan(payloads: MvpPersistencePayloads): SqlInsertPlan {
  return {
    statements: INSERT_TABLE_ORDER.flatMap(table => {
      const rows = payloads[table];
      return rows.map(row => buildInsertStatement(table, row));
    })
  };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'novel';
}

function deterministicId(seed: string, table: string, key: string): string {
  const hex = createHash('sha256').update(`${seed}:${table}:${key}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function firstLocationId(locationIds: Map<string, string>): string | null {
  return locationIds.values().next().value ?? null;
}

function buildInsertStatement(table: typeof INSERT_TABLE_ORDER[number], row: Record<string, unknown>): SqlStatement {
  const columns = Object.keys(row).filter(column => row[column] !== undefined);
  if (columns.length === 0) {
    throw new Error(`Cannot build insert for ${table} without columns.`);
  }

  return {
    text: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')}) ON CONFLICT DO NOTHING;`,
    values: columns.map(column => row[column])
  };
}
