import { describe, it, expect } from 'vitest';
import { mapLongformPlanToPersistence } from '../mappers/persistence.mapper';
import { LongformPlan } from '../types';

describe('persistence.mapper', () => {
  const dummyPlan: LongformPlan = {
    arcs: [{
      id: 'a1', arc_number: 1, title: 'A', purpose: 'P', status: 'planned', summary: 'S', metadata: {}
    }],
    sub_arcs: [{
      id: 's1', arc_id: 'a1', sub_arc_number: 1, title: 'A', purpose: 'P', status: 'planned', summary: 'S', metadata: {}
    }],
    chapter_outlines: [{
      id: 'c1', arc_id: 'a1', sub_arc_id: 's1', chapter_number: 1, title: 'A', purpose: 'P', outline: {}, status: 'planned'
    }],
    plot_threads: [{
      id: 'pt1', title: 'PT', status: 'open', priority: 1, description: 'D', metadata: {}
    }],
    timelines: [{
      id: 't1', name: 'T', description: 'D'
    }],
    story_events: [{
      id: 'e1', timeline_id: 't1', sequence_number: 1, chapter_number: 1, title: 'T', description: 'D', event_type: 'E', payload: {}
    }]
  };

  it('maps correctly using only Phase 1 schema columns', () => {
    const payloads = mapLongformPlanToPersistence(dummyPlan, 'novel-123');

    // arcs
    expect(Object.keys(payloads.arcs[0]).sort()).toEqual(
      ['novel_id', 'arc_number', 'title', 'purpose', 'status', 'summary', 'metadata'].sort()
    );

    // sub_arcs
    expect(Object.keys(payloads.sub_arcs[0]).sort()).toEqual(
      ['arc_id', 'sub_arc_number', 'title', 'purpose', 'status', 'summary', 'metadata'].sort()
    );

    // chapter_outlines
    expect(Object.keys(payloads.chapter_outlines[0]).sort()).toEqual(
      ['novel_id', 'arc_id', 'sub_arc_id', 'chapter_number', 'title', 'purpose', 'outline', 'status'].sort()
    );

    // plot_threads
    expect(Object.keys(payloads.plot_threads[0]).sort()).toEqual(
      ['novel_id', 'title', 'status', 'priority', 'description', 'metadata'].sort()
    );

    // story_events
    expect(Object.keys(payloads.story_events[0]).sort()).toEqual(
      ['novel_id', 'timeline_id', 'chapter_number', 'sequence_number', 'title', 'description', 'event_type', 'payload'].sort()
    );
    expect(payloads.story_events[0].timeline_id).toBe('t1');
  });
});
