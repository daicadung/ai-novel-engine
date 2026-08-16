import { ConceptCandidate, StoryDna } from '@ai-novel-engine/concept-engine';
import { ChapterDraft, WriterContext } from '@ai-novel-engine/chapter-writer';
import { LongformPlanner, LongformPlan } from '@ai-novel-engine/longform-planner';
import { ContinuityChecker, ContinuityReport, ContinuitySnapshot, ExtractedMemory } from '@ai-novel-engine/memory-continuity';
import { StoryBibleDraft } from '@ai-novel-engine/story-architect';

export interface MvpPipelineOptions {
  chapterCount?: number;
  language?: string;
}

export interface MvpChapterResult {
  draft: ChapterDraft;
  memory: ExtractedMemory;
  continuity: ContinuityReport;
}

export interface MvpNovelResult {
  title: string;
  concept: ConceptCandidate;
  dna: StoryDna;
  bible: StoryBibleDraft;
  plan: LongformPlan;
  chapters: MvpChapterResult[];
}

export function generateMvpNovel(title: string, options: MvpPipelineOptions = {}): MvpNovelResult {
  const cleanTitle = title.trim();
  if (!cleanTitle) {
    throw new Error('Title must not be empty.');
  }

  const chapterCount = options.chapterCount ?? 3;
  if (!Number.isInteger(chapterCount) || chapterCount < 1) {
    throw new Error('chapterCount must be a positive integer.');
  }

  const language = options.language ?? 'Vietnamese';
  const concept = buildConcept(cleanTitle);
  const dna = buildDna(concept);
  const bible = buildBible(cleanTitle, concept, language);
  const planner = new LongformPlanner();
  const plan = planner.plan(
    { title: cleanTitle, bible },
    { targetChapters: chapterCount, targetArcs: Math.min(3, chapterCount), seed: cleanTitle }
  );
  const checker = new ContinuityChecker();
  const chapters: MvpChapterResult[] = [];
  const summaries: string[] = [];
  const snapshot = buildInitialSnapshot(bible);

  for (const outline of plan.chapter_outlines) {
    const context: WriterContext = {
      target_outline: outline,
      previous_summaries: summaries.slice(-3),
      relevant_characters: bible.characters,
      relevant_locations: bible.locations,
      active_plot_threads: plan.plot_threads.filter(thread => thread.status !== 'resolved'),
      recent_story_events: plan.story_events.slice(-5),
      style_guide: {
        language,
        tone: bible.bible.tone,
        pov: 'third-person limited',
        tense: 'past',
        prose_density: 'medium',
        dialogue_ratio: 'balanced',
        taboo_phrases: [],
        required_rules: ['preserve established world rules', 'advance one active plot thread']
      },
      world_rules: bible.world.rules,
      continuity_notes: 'Use only established characters, locations, and items.'
    };
    const draft = writeDeterministicChapter(cleanTitle, context);
    const memory = extractDeterministicMemory(draft, outline.chapter_number, bible);
    const continuity = checker.check(draft, memory, snapshot);
    chapters.push({ draft, memory, continuity });
    summaries.push(draft.summary);
    applyMemory(snapshot, memory);
  }

  return { title: cleanTitle, concept, dna, bible, plan, chapters };
}

function buildConcept(title: string): ConceptCandidate {
  return {
    title: `${title}: Broken Origin`,
    premise: `${title} follows a fallen heir rebuilding power through a forbidden legacy.`,
    genre: 'xianxia',
    setting: 'fractured cultivation empire',
    protagonist_archetype: 'fallen genius',
    theme: 'identity through earned strength',
    conflict: 'sect politics and ancient debt',
    progression_model: 'weak-to-strong',
    power_system: 'sword cultivation',
    narrative_structure: 'long-form progression',
    ending_direction: 'ascension with personal cost'
  };
}

function buildDna(concept: ConceptCandidate): StoryDna {
  return {
    concept_dna: { premise: concept.premise, genre: concept.genre },
    world_dna: { setting: concept.setting },
    character_dna: { archetype: concept.protagonist_archetype },
    power_system_dna: { model: concept.power_system },
    faction_dna: { conflict: concept.conflict },
    plot_dna: { progression: concept.progression_model },
    arc_dna: { structure: concept.narrative_structure },
    event_dna: { opening: 'exile' },
    ending_dna: { direction: concept.ending_direction }
  };
}

function buildBible(title: string, concept: ConceptCandidate, language: string): StoryBibleDraft {
  return {
    bible: {
      premise: concept.premise,
      genre: concept.genre ?? 'fantasy',
      tone: 'tense, disciplined, mythic',
      style_guide: { language },
      rules: { permanent_death_matters: true, cultivation_requires_cost: true }
    },
    world: {
      name: 'Nine Vein Continent',
      description: 'A divided continent where sword veins decide status and survival.',
      rules: { sword_veins: 'power grows through trial, not inheritance' },
      history: { founding_war: 'old emperors shattered the first sword road' }
    },
    locations: [
      { name: 'Ashen Gate Sect', kind: 'sect', description: 'A harsh outer sect guarding broken sword mines.', metadata: {} }
    ],
    factions: [
      { name: 'Ashen Gate', kind: 'sect', description: 'A practical sect that values results over birth.', goals: ['control sword vein mines'], metadata: {} }
    ],
    characters: [
      {
        name: 'Linh Kiem',
        role: 'protagonist',
        description: `${title} heir stripped of rank but not resolve.`,
        personality: { core: 'patient, proud, observant' },
        goals: ['recover lost sword vein', 'learn truth behind exile'],
        secrets: ['he carries an unawakened emperor mark'],
        metadata: {},
        initial_state: {
          status: 'alive',
          power_state: { realm: 'Mortal Sword Initiate' },
          inventory: ['cracked iron sword'],
          relationships: {},
          notes: 'exiled but mobile',
          current_location_name: 'Ashen Gate Sect'
        }
      }
    ],
    items: [
      { name: 'cracked iron sword', kind: 'weapon', description: 'A plain blade with hidden resonance.', state: { condition: 'worn' }, owner_character_name: 'Linh Kiem' }
    ],
    abilities: [
      { name: 'First Vein Listening', kind: 'cultivation', description: 'Sense faint sword intent in damaged metal.', rules: ['requires stillness'], limitations: ['fails under panic'], character_name: 'Linh Kiem' }
    ],
    timeline: {
      name: 'Main Timeline',
      description: 'Rise from exile to sword sovereignty.',
      events: [{ sequence_number: 1, title: 'Exile', description: 'Linh Kiem reaches Ashen Gate.', event_type: 'backstory', payload: {} }]
    },
    plot_threads: [
      { title: 'Recover the lost sword vein', status: 'active', priority: 1, description: 'Find why the protagonist lost innate power.', metadata: {} }
    ]
  };
}

function writeDeterministicChapter(title: string, context: WriterContext): ChapterDraft {
  const character = context.relevant_characters[0];
  const location = context.relevant_locations[0];
  const thread = context.active_plot_threads[0];
  const chapterTitle = `${title} - ${context.target_outline.title}`;
  const beats = Array.isArray(context.target_outline.outline.beats)
    ? context.target_outline.outline.beats.filter((beat): beat is string => typeof beat === 'string')
    : [];
  return {
    title: chapterTitle,
    content: `${character.name} crossed ${location.name} and followed the chapter beat: ${beats.join(', ')}. The cracked iron sword answered once, enough to move the thread "${thread.title}" forward without breaking world rules.`,
    summary: `${character.name} advanced ${thread.title} at ${location.name}.`,
    word_count: 38,
    advanced_plot_threads: [thread.title],
    introduced_facts: [`${location.name} contains damaged sword intent.`],
    continuity_risks: []
  };
}

function extractDeterministicMemory(draft: ChapterDraft, chapterNumber: number, bible: StoryBibleDraft): ExtractedMemory {
  const character = bible.characters[0];
  const location = bible.locations[0];
  const thread = bible.plot_threads[0];
  return {
    chapter_number: chapterNumber,
    character_deltas: [{ character_name: character.name, status: 'alive', location_name: location.name, notes: draft.summary }],
    relationship_deltas: [],
    location_deltas: [{ location_name: location.name, state_changes: { last_chapter_seen: chapterNumber } }],
    item_deltas: [],
    plot_thread_deltas: [{ thread_title: thread.title, status: 'active', development_summary: draft.summary }],
    story_events: [{ title: draft.title, description: draft.summary, event_type: 'chapter_progress' }],
    foreshadowing: [{ description: 'The cracked iron sword may contain an older intent.' }]
  };
}

function buildInitialSnapshot(bible: StoryBibleDraft): ContinuitySnapshot {
  return {
    characters: bible.characters.map(character => ({
      name: character.name,
      status: character.initial_state?.status ?? 'alive',
      location_name: character.initial_state?.current_location_name
    })),
    items: bible.items.map(item => ({
      name: item.name,
      state: String(item.state.condition ?? 'available'),
      owner_name: item.owner_character_name,
      location_name: item.location_name
    })),
    plot_threads: bible.plot_threads.map(thread => ({ title: thread.title, status: thread.status })),
    world_rules: Object.keys(bible.world.rules)
  };
}

function applyMemory(snapshot: ContinuitySnapshot, memory: ExtractedMemory): void {
  for (const delta of memory.character_deltas) {
    const character = snapshot.characters.find(item => item.name === delta.character_name);
    if (character) {
      character.status = delta.status ?? character.status;
      character.location_name = delta.location_name ?? character.location_name;
    }
  }
  for (const delta of memory.plot_thread_deltas) {
    const thread = snapshot.plot_threads.find(item => item.title === delta.thread_title);
    if (thread) {
      thread.status = delta.status ?? thread.status;
    }
  }
}
