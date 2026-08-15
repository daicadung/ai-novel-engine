import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArchitectManager, MockProvider } from '../src/services/architect/index.js';
import { ArchitectStage, STAGE_REGISTRY } from '@ane/core';

describe('ArchitectManager & StageRegistry (DB-Free)', () => {
  let provider: MockProvider;
  let manager: ArchitectManager;

  beforeEach(() => {
    provider = new MockProvider();
    manager = new ArchitectManager(provider);
  });

  it('Stage Registry has correct dependencies', () => {
    expect(STAGE_REGISTRY[ArchitectStage.CONCEPT].dependencies).toEqual([]);
    expect(STAGE_REGISTRY[ArchitectStage.PREMISE].dependencies).toContain(ArchitectStage.CONCEPT);
    expect(STAGE_REGISTRY[ArchitectStage.WORLD].dependencies).toContain(ArchitectStage.PREMISE);
  });

  it('MockProvider returns realistic structured output', async () => {
    const result = await provider.generateStructured('STAGE: CONCEPT', STAGE_REGISTRY.CONCEPT.outputSchema);
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('hook');
    expect(result.genreCandidates.length).toBeGreaterThan(0);
  });

  it('getDownstreamStages correctly identifies all downstream stages', () => {
    const downstream = manager.getDownstreamStages(ArchitectStage.CONCEPT);
    // Almost everything depends on Concept eventually (Concept -> Premise -> World -> Characters -> Conflicts -> Plot -> ...)
    expect(downstream).toContain(ArchitectStage.PREMISE);
    expect(downstream).toContain(ArchitectStage.WORLD);
    expect(downstream).toContain(ArchitectStage.STORY_BIBLE_FINALIZATION);
  });

  it('getDownstreamStages correctly identifies partial downstream stages', () => {
    const downstream = manager.getDownstreamStages(ArchitectStage.FACTIONS);
    // FACTIONS -> CONFLICTS -> PLOT_THREADS -> CHARACTER_ARCS -> FORESHADOWING / LONG_TERM -> FINALIZATION
    expect(downstream).toContain(ArchitectStage.CONFLICTS);
    expect(downstream).toContain(ArchitectStage.PLOT_THREADS);
    expect(downstream).toContain(ArchitectStage.STORY_BIBLE_FINALIZATION);
    expect(downstream).not.toContain(ArchitectStage.CONCEPT);
    expect(downstream).not.toContain(ArchitectStage.CHARACTERS); // Characters doesn't depend on Factions
  });

  // DB dependent tests for manager.runStage would normally be mocked or skipped here.
  // We'll skip the actual execution since we require Prisma which is not mocked in this DB-free suite.
  it.skip('runStage handles state transitions and concurrency (Requires DB)', () => {});
  it.skip('failed regeneration preserves canonical state (Requires DB)', () => {});
  it.skip('successful regeneration replaces canonical state transactionally (Requires DB)', () => {});
  it.skip('duplicate regeneration is idempotent without generating duplicate entities (Requires DB)', () => {});
  it.skip('downstream stages become STALE without being deleted (Requires DB)', () => {});
});
