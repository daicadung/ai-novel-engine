import { LlmProvider } from '@ai-novel-engine/llm-gateway';
import { ConceptCandidate, StoryDna } from '@ai-novel-engine/concept-engine';

export interface StoryArchitectInput {
  title: string;
  concept: ConceptCandidate;
  dna: StoryDna;
  language?: string;
  targetChapterCount?: number;
  styleNotes?: string;
}

export interface StoryBibleDraft {
  bible: {
    premise: string;
    genre: string;
    tone: string;
    style_guide: Record<string, unknown>;
    rules: Record<string, unknown>;
  };
  world: WorldDraft;
  locations: LocationDraft[];
  factions: FactionDraft[];
  characters: CharacterDraft[];
  items: ItemDraft[];
  abilities: AbilityDraft[];
  timeline: {
    name: string;
    description: string;
    events: TimelineEventDraft[];
  };
  plot_threads: PlotThreadDraft[];
}

export interface WorldDraft {
  name: string;
  description: string;
  rules: Record<string, unknown>;
  history: Record<string, unknown>;
}

export interface LocationDraft {
  name: string;
  kind: string;
  description: string;
  metadata: Record<string, unknown>;
  parentName?: string;
}

export interface FactionDraft {
  name: string;
  kind: string;
  description: string;
  goals: string[];
  metadata: Record<string, unknown>;
}

export interface CharacterDraft {
  name: string;
  role: string;
  description: string;
  personality: Record<string, unknown>;
  goals: string[];
  secrets: string[];
  metadata: Record<string, unknown>;
  initial_state?: {
    status: string;
    power_state: Record<string, unknown>;
    inventory: string[];
    relationships: Record<string, unknown>;
    notes: string;
    current_location_name?: string;
  };
}

export interface ItemDraft {
  name: string;
  kind: string;
  description: string;
  state: Record<string, unknown>;
  owner_character_name?: string;
  location_name?: string;
}

export interface AbilityDraft {
  name: string;
  kind: string;
  description: string;
  rules: string[];
  limitations: string[];
  character_name?: string;
}

export interface TimelineEventDraft {
  sequence_number: number;
  title: string;
  description: string;
  event_type: string;
  payload: Record<string, unknown>;
}

export type PlotThreadStatus = 'open' | 'active' | 'resolved' | 'dropped';

export interface PlotThreadDraft {
  title: string;
  status: PlotThreadStatus;
  priority: number;
  description: string;
  metadata: Record<string, unknown>;
}

export interface ArchitectPersistencePayloads {
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
}

export interface StoryArchitectConfig {
  provider: LlmProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}
