import { LongformPlan } from '../types';

export interface Phase1LongformPayloads {
  arcs: Record<string, unknown>[];
  sub_arcs: Record<string, unknown>[];
  chapter_outlines: Record<string, unknown>[];
  plot_threads: Record<string, unknown>[];
  timelines: Record<string, unknown>[];
  story_events: Record<string, unknown>[];
}

// ponytail: current ceiling is name-reference payloads only; upgrade path is two-phase insert resolver.
export function mapLongformPlanToPersistence(plan: LongformPlan, novelId: string): Phase1LongformPayloads {
  const arcs = plan.arcs.map(a => ({
    novel_id: novelId,
    arc_number: a.arc_number,
    title: a.title,
    purpose: a.purpose,
    status: a.status,
    summary: a.summary,
    metadata: a.metadata,
  }));

  const sub_arcs = plan.sub_arcs.map(s => ({
    arc_id: s.arc_id, // Placeholders for resolver
    sub_arc_number: s.sub_arc_number,
    title: s.title,
    purpose: s.purpose,
    status: s.status,
    summary: s.summary,
    metadata: s.metadata,
  }));

  const chapter_outlines = plan.chapter_outlines.map(c => ({
    novel_id: novelId,
    arc_id: c.arc_id, // Placeholders
    sub_arc_id: c.sub_arc_id, // Placeholders
    chapter_number: c.chapter_number,
    title: c.title,
    purpose: c.purpose,
    outline: c.outline,
    status: c.status,
  }));

  const plot_threads = plan.plot_threads.map(pt => ({
    novel_id: novelId,
    title: pt.title,
    status: pt.status,
    priority: pt.priority,
    description: pt.description,
    metadata: pt.metadata,
  }));

  const timelines = plan.timelines.map(t => ({
    novel_id: novelId,
    name: t.name,
    description: t.description,
  }));

  const story_events = plan.story_events.map(t => ({
    novel_id: novelId,
    timeline_id: t.timeline_id,
    chapter_number: t.chapter_number,
    sequence_number: t.sequence_number,
    title: t.title,
    description: t.description,
    event_type: t.event_type,
    payload: t.payload,
  }));

  return {
    arcs,
    sub_arcs,
    chapter_outlines,
    plot_threads,
    timelines,
    story_events,
  };
}
