import { LlmProvider } from '@ai-novel-engine/llm-gateway';
import { StoryBibleDraft, CharacterDraft, LocationDraft } from '@ai-novel-engine/story-architect';
import { ChapterOutlinePlan, PlotThreadPlan, TimelineEventPlan } from '@ai-novel-engine/longform-planner';

export interface StyleProfile {
  language: string;
  tone: string;
  pov: string;
  tense: string;
  prose_density: string;
  dialogue_ratio: string;
  taboo_phrases: string[];
  required_rules: string[];
}

export interface WriterContext {
  target_outline: ChapterOutlinePlan;
  previous_summaries: string[];
  relevant_characters: CharacterDraft[];
  relevant_locations: LocationDraft[];
  active_plot_threads: PlotThreadPlan[];
  recent_story_events: TimelineEventPlan[];
  style_guide: StyleProfile;
  world_rules: Record<string, unknown>;
  continuity_notes: string; // Placeholder
}

export interface ChapterDraft {
  title: string;
  content: string;
  summary: string;
  word_count: number;
  advanced_plot_threads: string[];
  introduced_facts: string[];
  continuity_risks: string[];
}

export interface WriterConfig {
  provider: LlmProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
}
