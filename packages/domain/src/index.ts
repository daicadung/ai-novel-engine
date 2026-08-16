export const NOVEL_STATUSES = ['draft', 'planning', 'active', 'paused', 'completed', 'archived'] as const;
export const PLOT_THREAD_STATUSES = ['open', 'active', 'resolved', 'dropped'] as const;
export const ARC_STATUSES = ['planned', 'active', 'completed'] as const;
export const CHAPTER_OUTLINE_STATUSES = ['planned', 'approved', 'used'] as const;
export const CHAPTER_STATUSES = ['draft', 'checking', 'approved', 'published', 'failed'] as const;

export type NovelStatus = (typeof NOVEL_STATUSES)[number];
export type PlotThreadStatus = (typeof PLOT_THREAD_STATUSES)[number];
export type ArcStatus = (typeof ARC_STATUSES)[number];
export type ChapterOutlineStatus = (typeof CHAPTER_OUTLINE_STATUSES)[number];
export type ChapterStatus = (typeof CHAPTER_STATUSES)[number];

export interface Novel {
  id: string;
  owner_id: string;
  title: string;
  slug?: string;
  status: NovelStatus;
  language: string;
  target_chapter_count?: number;
  target_chapter_length?: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface StoryBible {
  id: string;
  novel_id: string;
  premise?: string;
  genre?: string;
  tone?: string;
  style_guide: Record<string, any>;
  rules: Record<string, any>;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface World {
  id: string;
  novel_id: string;
  name: string;
  description?: string;
  rules: Record<string, any>;
  history: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  novel_id: string;
  parent_location_id?: string;
  name: string;
  kind?: string;
  description?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Faction {
  id: string;
  novel_id: string;
  name: string;
  kind?: string;
  description?: string;
  goals: any[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Character {
  id: string;
  novel_id: string;
  name: string;
  role?: string;
  description?: string;
  personality: Record<string, any>;
  goals: any[];
  secrets: any[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CharacterState {
  id: string;
  character_id: string;
  chapter_number?: number;
  location_id?: string;
  status?: string;
  power_state: Record<string, any>;
  inventory: any[];
  relationships: Record<string, any>;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  novel_id: string;
  owner_character_id?: string;
  location_id?: string;
  name: string;
  kind?: string;
  description?: string;
  state: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Ability {
  id: string;
  novel_id: string;
  character_id?: string;
  name: string;
  kind?: string;
  description?: string;
  rules: any[];
  limitations: any[];
  created_at: string;
  updated_at: string;
}

export interface Timeline {
  id: string;
  novel_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface StoryEvent {
  id: string;
  novel_id: string;
  timeline_id?: string;
  chapter_number?: number;
  sequence_number: number;
  title: string;
  description?: string;
  event_type?: string;
  payload: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PlotThread {
  id: string;
  novel_id: string;
  title: string;
  status: PlotThreadStatus;
  priority?: number;
  description?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Arc {
  id: string;
  novel_id: string;
  arc_number: number;
  title: string;
  purpose?: string;
  status: ArcStatus;
  summary?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SubArc {
  id: string;
  arc_id: string;
  sub_arc_number: number;
  title: string;
  purpose?: string;
  status: ArcStatus;
  summary?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ChapterOutline {
  id: string;
  novel_id: string;
  arc_id?: string;
  sub_arc_id?: string;
  chapter_number: number;
  title?: string;
  purpose?: string;
  outline: Record<string, any>;
  status: ChapterOutlineStatus;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: string;
  novel_id: string;
  outline_id?: string;
  chapter_number: number;
  title?: string;
  content?: string;
  summary?: string;
  status: ChapterStatus;
  word_count?: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}
