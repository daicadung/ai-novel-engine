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
  plot_thread_updates: Record<string, Record<string, unknown>>[];
  item_updates: Record<string, Record<string, unknown>>[];
}

export function mapMvpNovelToPersistence(
  result: MvpNovelResult,
  ids: { ownerId: string; novelId: string; conceptCandidateId?: string }
): MvpPersistencePayloads {
  if (!ids.ownerId.trim() || !ids.novelId.trim()) {
    throw new Error('ownerId and novelId are required.');
  }

  const conceptCandidateId = ids.conceptCandidateId ?? `${ids.novelId}:concept:1`;
  const architect = mapStoryBibleDraftToPersistence(result.bible, ids.novelId);
  const longform = mapLongformPlanToPersistence(result.plan, ids.novelId);
  const chapterRows = result.chapters.map((chapter, index) => {
    const outline = result.plan.chapter_outlines[index];
    return mapChapterDraftToPersistence(
      chapter.draft,
      ids.novelId,
      outline?.id ?? null,
      chapter.memory.chapter_number
    );
  });
  const memoryCharacterStates = result.chapters.flatMap(chapter =>
    Object.entries(mapMemoryToCharacterStates(chapter.memory)).map(([characterName, payload]) => ({
      ...payload,
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
      owner_id: ids.ownerId,
      novel_id: ids.novelId,
      concept_candidate_id: conceptCandidateId,
      dna_version: 1,
      ...result.dna
    }],
    story_bibles: architect.story_bibles,
    worlds: architect.worlds,
    locations: architect.locations,
    factions: architect.factions,
    characters: architect.characters,
    character_states: [...architect.character_states, ...memoryCharacterStates],
    items: architect.items,
    abilities: architect.abilities,
    timelines: [...architect.timelines, ...longform.timelines],
    story_events: [...architect.story_events, ...longform.story_events, ...memoryStoryEvents],
    plot_threads: [...architect.plot_threads, ...longform.plot_threads],
    arcs: longform.arcs,
    sub_arcs: longform.sub_arcs,
    chapter_outlines: longform.chapter_outlines,
    chapters: chapterRows,
    plot_thread_updates: plotThreadUpdates,
    item_updates: itemUpdates
  };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'novel';
}
