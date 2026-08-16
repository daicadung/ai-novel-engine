import { StoryBibleDraft } from '@ai-novel-engine/story-architect';

export const LONGFORM_PHASES = {
  SETUP: 'setup',
  ESCALATION: 'escalation',
  REVERSAL: 'reversal',
  CLIMAX: 'climax',
  FALLOUT: 'fallout',
} as const;

export type LongformPhase = typeof LONGFORM_PHASES[keyof typeof LONGFORM_PHASES];

export interface LongformPlannerConfig {
  targetChapters: number;
  targetArcs?: number;
  chaptersPerArcRange?: [number, number];
  chaptersPerSubArcRange?: [number, number];
  seed?: string | number;
}

export interface LongformPlannerInput {
  title: string;
  bible: StoryBibleDraft;
}

export interface ArcPlan {
  id: string; // Planner-generated stable ID
  arc_number: number;
  title: string;
  purpose: string;
  status: 'planned';
  summary: string;
  metadata: Record<string, unknown>;
}

export interface SubArcPlan {
  id: string; // Planner-generated stable ID
  arc_id: string;
  sub_arc_number: number;
  title: string;
  purpose: string;
  status: 'planned';
  summary: string;
  metadata: Record<string, unknown>;
}

export interface ChapterOutlinePlan {
  id: string; // Planner-generated stable ID
  arc_id: string;
  sub_arc_id: string;
  chapter_number: number;
  title: string;
  purpose: string;
  outline: Record<string, unknown>;
  status: 'planned';
}

export interface PlotThreadPlan {
  id: string; // Planner-generated stable ID
  title: string;
  status: 'open' | 'active' | 'resolved' | 'dropped';
  priority: number;
  description: string;
  metadata: Record<string, unknown>;
}

export interface TimelineEventPlan {
  id: string; 
  timeline_id: string; // References TimelinePlan
  sequence_number: number;
  chapter_number: number; 
  title: string;
  description: string;
  event_type: string;
  payload: Record<string, unknown>;
}

export interface TimelinePlan {
  id: string;
  name: string;
  description: string;
}

export interface LongformPlan {
  arcs: ArcPlan[];
  sub_arcs: SubArcPlan[];
  chapter_outlines: ChapterOutlinePlan[];
  plot_threads: PlotThreadPlan[];
  timelines: TimelinePlan[];
  story_events: TimelineEventPlan[];
}
