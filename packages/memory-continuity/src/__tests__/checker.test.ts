import { describe, it, expect } from 'vitest';
import { ContinuityChecker } from '../core/checker';
import { ContinuitySnapshot, ExtractedMemory } from '../types';
import { ChapterDraft } from '@ai-novel-engine/chapter-writer';

describe('Continuity Checker', () => {
  const checker = new ContinuityChecker();

  const mockSnapshot: ContinuitySnapshot = {
    characters: [{ name: 'DeadGuy', status: 'dead' }],
    items: [{ name: 'MacGuffin', state: 'destroyed' }],
    plot_threads: [{ title: 'Main Quest', status: 'resolved' }],
    world_rules: []
  };

  const emptyMemory: ExtractedMemory = {
    chapter_number: 1, character_deltas: [], relationship_deltas: [], location_deltas: [], item_deltas: [], plot_thread_deltas: [], story_events: [], foreshadowing: []
  };

  it('passes when no violations occur', () => {
    const draft: ChapterDraft = { title: '', content: '', summary: '', word_count: 0, advanced_plot_threads: [], introduced_facts: [], continuity_risks: [] };
    const report = checker.check(draft, emptyMemory, mockSnapshot);
    expect(report.pass).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it('fails with minor severity when draft identifies risks', () => {
    const draft: ChapterDraft = { title: '', content: '', summary: '', word_count: 0, advanced_plot_threads: [], introduced_facts: [], continuity_risks: ['Might contradict ch 1'] };
    const report = checker.check(draft, emptyMemory, mockSnapshot);
    expect(report.pass).toBe(true); // minor issues pass
    expect(report.maxSeverity).toBe('minor');
    expect(report.issues).toHaveLength(1);
  });

  it('fails with major severity when resolved plot thread advances', () => {
    const draft: ChapterDraft = { title: '', content: '', summary: '', word_count: 0, advanced_plot_threads: [], introduced_facts: [], continuity_risks: [] };
    const memory = { ...emptyMemory, plot_thread_deltas: [{ thread_title: 'Main Quest', status: 'active' as const }] };
    const report = checker.check(draft, memory, mockSnapshot);
    expect(report.pass).toBe(false);
    expect(report.maxSeverity).toBe('major');
  });

  it('fails with critical severity when destroyed item is modified', () => {
    const draft: ChapterDraft = { title: '', content: '', summary: '', word_count: 0, advanced_plot_threads: [], introduced_facts: [], continuity_risks: [] };
    const memory = { ...emptyMemory, item_deltas: [{ item_name: 'MacGuffin', state_changes: { sharp: true } }] };
    const report = checker.check(draft, memory, mockSnapshot);
    expect(report.pass).toBe(false);
    expect(report.maxSeverity).toBe('critical');
  });

  it('fails with critical severity when dead character acts without revival', () => {
    const draft: ChapterDraft = { title: '', content: '', summary: '', word_count: 0, advanced_plot_threads: [], introduced_facts: [], continuity_risks: [] };
    const memory = { ...emptyMemory, character_deltas: [{ character_name: 'DeadGuy', power_state_changes: { level: 2 } }] };
    const report = checker.check(draft, memory, mockSnapshot);
    expect(report.pass).toBe(false);
    expect(report.maxSeverity).toBe('critical');
  });

  it('passes if dead character is explicitly revived', () => {
    const draft: ChapterDraft = { title: '', content: '', summary: '', word_count: 0, advanced_plot_threads: [], introduced_facts: [], continuity_risks: [] };
    const memory = { ...emptyMemory, character_deltas: [{ character_name: 'DeadGuy', status: 'revived' }] };
    const report = checker.check(draft, memory, mockSnapshot);
    expect(report.pass).toBe(true);
  });
});
