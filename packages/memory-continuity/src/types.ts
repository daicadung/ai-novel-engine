export interface CharacterStateDelta {
  character_name: string; // Since we don't have UUID resolution yet
  status?: string;
  location_name?: string;
  power_state_changes?: Record<string, unknown>;
  inventory_changes?: { added?: string[]; removed?: string[] };
  notes?: string;
}

export interface RelationshipDelta {
  character_a_name: string;
  character_b_name: string;
  relationship_change: string;
}

export interface LocationDelta {
  location_name: string;
  state_changes: Record<string, unknown>;
}

export interface ItemDelta {
  item_name: string;
  new_owner_name?: string;
  new_location_name?: string;
  state_changes?: Record<string, unknown>;
}

export interface PlotThreadDelta {
  thread_title: string;
  status?: 'open' | 'active' | 'resolved' | 'dropped';
  development_summary?: string;
}

export interface StoryEventDelta {
  title: string;
  description: string;
  event_type: string;
  payload?: Record<string, unknown>;
}

export interface ForeshadowingSignal {
  description: string;
  target_arc?: string;
}

export interface ExtractedMemory {
  chapter_number: number;
  character_deltas: CharacterStateDelta[];
  relationship_deltas: RelationshipDelta[];
  location_deltas: LocationDelta[];
  item_deltas: ItemDelta[];
  plot_thread_deltas: PlotThreadDelta[];
  story_events: StoryEventDelta[];
  foreshadowing: ForeshadowingSignal[];
}

export type ContinuitySeverity = 'minor' | 'major' | 'critical';

export interface ContinuityIssue {
  severity: ContinuitySeverity;
  description: string;
  rule_violated?: string;
}

export interface ContinuityReport {
  pass: boolean;
  issues: ContinuityIssue[];
  maxSeverity?: ContinuitySeverity;
}

export interface ContinuitySnapshot {
  characters: Array<{ name: string; status: string; location_name?: string; }>;
  items: Array<{ name: string; state: string; owner_name?: string; location_name?: string; }>;
  plot_threads: Array<{ title: string; status: string; }>;
  world_rules: string[];
}
