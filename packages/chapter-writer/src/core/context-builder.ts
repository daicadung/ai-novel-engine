import { StoryBibleDraft } from '@ai-novel-engine/story-architect';
import { LongformPlan, ChapterOutlinePlan } from '@ai-novel-engine/longform-planner';
import { WriterContext, StyleProfile } from '../types';

export interface ContextBuilderConfig {
  maxCharacters?: number;
  maxLocations?: number;
  maxPlotThreads?: number;
  maxStoryEvents?: number;
  maxPreviousSummaries?: number;
}

export function buildWriterContext(
  bible: StoryBibleDraft,
  plan: LongformPlan,
  targetOutline: ChapterOutlinePlan,
  prevSummaries: string[],
  config: ContextBuilderConfig = {},
  styleGuide: StyleProfile
): WriterContext {
  const maxChars = config.maxCharacters ?? 5;
  const maxLocs = config.maxLocations ?? 2;
  const maxThreads = config.maxPlotThreads ?? 3;
  const maxEvents = config.maxStoryEvents ?? 5;
  const maxSums = config.maxPreviousSummaries ?? 2;

  // ponytail: lexical/recent selection only; upgrade path semantic/vector retrieval.
  
  // 1. Previous summaries (take last N)
  const relevantSummaries = prevSummaries.slice(-maxSums);

  // 2. Characters (take first N from bible, ideally would filter by relevance)
  const relevantCharacters = bible.characters.slice(0, maxChars);

  // 3. Locations (take first N from bible)
  const relevantLocations = bible.locations.slice(0, maxLocs);

  // 4. Plot threads (take open/active ones)
  const activePlotThreads = plan.plot_threads
    .filter(pt => pt.status === 'open' || pt.status === 'active')
    .slice(0, maxThreads);

  // 5. Story events (take recent past events and current chapter events)
  const recentStoryEvents = plan.story_events
    .filter(ev => ev.chapter_number <= targetOutline.chapter_number)
    .sort((a, b) => b.chapter_number - a.chapter_number || b.sequence_number - a.sequence_number)
    .slice(0, maxEvents);

  return {
    target_outline: targetOutline,
    previous_summaries: relevantSummaries,
    relevant_characters: relevantCharacters,
    relevant_locations: relevantLocations,
    active_plot_threads: activePlotThreads,
    recent_story_events: recentStoryEvents,
    style_guide: styleGuide,
    world_rules: bible.world.rules,
    continuity_notes: 'Continuity checker not implemented yet.', // Placeholder
  };
}
