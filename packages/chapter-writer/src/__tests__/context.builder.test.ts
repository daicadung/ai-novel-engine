import { describe, it, expect } from 'vitest';
import { buildWriterContext } from '../core/context-builder';
import { StoryBibleDraft } from '@ai-novel-engine/story-architect';
import { LongformPlan } from '@ai-novel-engine/longform-planner';
import { StyleProfile } from '../types';

describe('ContextBuilder', () => {
  const dummyStyle: StyleProfile = {
    language: 'English',
    tone: 'Dark',
    pov: 'Third Person Limited',
    tense: 'Past',
    prose_density: 'High',
    dialogue_ratio: 'Low',
    taboo_phrases: [],
    required_rules: []
  };

  it('bounds output contexts to max limits', () => {
    const bible: StoryBibleDraft = {
      bible: { premise: 'P', genre: 'G', tone: 'T', style_guide: {}, rules: {} },
      world: { name: 'W', description: 'D', rules: {}, history: {} },
      locations: Array.from({ length: 10 }, (_, i) => ({ name: `L${i}`, kind: 'K', description: 'D', metadata: {} })),
      factions: [],
      characters: Array.from({ length: 10 }, (_, i) => ({ name: `C${i}`, role: 'R', description: 'D', personality: {}, goals: [], secrets: [], metadata: {} })),
      items: [],
      abilities: [],
      timeline: { name: 'T', description: 'D', events: [] },
      plot_threads: []
    };

    const plan: LongformPlan = {
      arcs: [],
      sub_arcs: [],
      chapter_outlines: [],
      timelines: [],
      story_events: Array.from({ length: 10 }, (_, i) => ({ id: `E${i}`, timeline_id: 'T', chapter_number: i, sequence_number: i, title: 'T', description: 'D', event_type: 'E', payload: {} })),
      plot_threads: Array.from({ length: 10 }, (_, i) => ({ id: `P${i}`, title: 'T', status: 'open', priority: 1, description: 'D', metadata: {} }))
    };

    const targetOutline = {
      id: 'O1',
      arc_id: 'A1',
      sub_arc_id: 'SA1',
      chapter_number: 5,
      title: 'Title',
      purpose: 'Purpose',
      status: 'planned' as const,
      outline: {}
    };

    const prevSummaries = ['1', '2', '3', '4'];

    const ctx = buildWriterContext(bible, plan, targetOutline, prevSummaries, {
      maxCharacters: 2,
      maxLocations: 3,
      maxPlotThreads: 4,
      maxStoryEvents: 2,
      maxPreviousSummaries: 2
    }, dummyStyle);

    expect(ctx.relevant_characters).toHaveLength(2);
    expect(ctx.relevant_locations).toHaveLength(3);
    expect(ctx.active_plot_threads).toHaveLength(4);
    expect(ctx.previous_summaries).toHaveLength(2);
    expect(ctx.previous_summaries).toEqual(['3', '4']);
    expect(ctx.recent_story_events).toHaveLength(2);
    expect(ctx.recent_story_events.every(e => e.chapter_number <= 5)).toBe(true);
  });
});
