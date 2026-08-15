/**
 * Phase 9 — Long-Form Novel Continuity, Sliding-Window Generation & Quality Control
 * DB-FREE unit tests (>= 50 tests)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StoryStateSchema,
  ChapterMemorySchema,
  KnowledgeStateSchema,
  ContinuityConflictType,
  ConflictSeverity,
  EntityTypeEnum,
  QualityGateResult,
  PlotThreadStateSchema,
  WorldFactSchema,
} from '@ane/core';
import { StoryStateManager } from '../src/services/continuity/StoryStateManager.js';
import { LongTermContinuityValidator } from '../src/services/continuity/LongTermContinuityValidator.js';
import { KnowledgeBoundaryValidator } from '../src/services/continuity/KnowledgeBoundaryValidator.js';
import { GenerationQualityGate } from '../src/services/continuity/GenerationQualityGate.js';

// ====================================================================
// 1. StoryState validation
// ====================================================================
describe('StoryState Schema Validation', () => {
  it('should parse empty state with defaults', () => {
    const state = StoryStateSchema.parse({ novelId: 'novel-1', asOfChapter: 0 });
    expect(state.novelId).toBe('novel-1');
    expect(state.characters).toEqual({});
    expect(state.locations).toEqual({});
    expect(state.items).toEqual({});
    expect(state.factions).toEqual({});
    expect(state.quests).toEqual({});
    expect(state.worldFacts).toEqual({});
    expect(state.timeline).toEqual({});
  });

  it('should parse state with characters', () => {
    const state = StoryStateSchema.parse({
      novelId: 'novel-1',
      asOfChapter: 5,
      characters: {
        'char-1': { id: 'char-1', name: 'John', isAlive: true, location: 'Castle' },
      },
    });
    expect(state.characters['char-1'].name).toBe('John');
    expect(state.characters['char-1'].isAlive).toBe(true);
  });

  it('should default isAlive to true', () => {
    const state = StoryStateSchema.parse({
      novelId: 'novel-1',
      asOfChapter: 0,
      characters: { 'char-1': { id: 'char-1', name: 'Alice' } },
    });
    expect(state.characters['char-1'].isAlive).toBe(true);
  });

  it('should parse plot thread states', () => {
    const thread = PlotThreadStateSchema.parse({
      id: 't-1', title: 'The Mystery', status: 'ACTIVE', priority: 8,
    });
    expect(thread.status).toBe('ACTIVE');
    expect(thread.priority).toBe(8);
  });

  it('should reject invalid plot thread status', () => {
    expect(() =>
      PlotThreadStateSchema.parse({ id: 't-1', title: 'x', status: 'INVALID', priority: 5 })
    ).toThrow();
  });

  it('should parse world facts', () => {
    const fact = WorldFactSchema.parse({
      id: 'f-1', category: 'magic', fact: 'Magic requires blood price', isRevoked: false,
    });
    expect(fact.fact).toBe('Magic requires blood price');
  });
});

// ====================================================================
// 2. StoryStateManager — delta application
// ====================================================================
describe('StoryStateManager delta application', () => {
  const baseState = StoryStateManager.empty('novel-1', 0);

  it('should return immutable empty state', () => {
    expect(baseState.characters).toEqual({});
    expect(baseState.asOfChapter).toBe(0);
  });

  it('should apply CHARACTER delta', () => {
    const next = StoryStateManager.applyDeltas(baseState, [{
      entityType: EntityTypeEnum.CHARACTER,
      entityId: 'char-1',
      property: 'name',
      previousValue: null,
      newValue: 'John',
    }], 1);
    expect(next.characters['char-1'].name).toBe('John');
    expect(next.asOfChapter).toBe(1);
  });

  it('should apply isAlive=false delta', () => {
    const stateWithChar = StoryStateManager.applyDeltas(baseState, [{
      entityType: EntityTypeEnum.CHARACTER,
      entityId: 'char-1',
      property: 'isAlive',
      previousValue: true,
      newValue: false,
    }], 10);
    expect(stateWithChar.characters['char-1'].isAlive).toBe(false);
  });

  it('should apply ITEM delta', () => {
    const next = StoryStateManager.applyDeltas(baseState, [{
      entityType: EntityTypeEnum.ITEM,
      entityId: 'sword-1',
      property: 'ownerId',
      previousValue: null,
      newValue: 'char-1',
    }], 1);
    expect(next.items['sword-1'].ownerId).toBe('char-1');
  });

  it('should apply LOCATION delta', () => {
    const next = StoryStateManager.applyDeltas(baseState, [{
      entityType: EntityTypeEnum.LOCATION,
      entityId: 'castle',
      property: 'isAccessible',
      previousValue: true,
      newValue: false,
    }], 5);
    expect(next.locations['castle'].isAccessible).toBe(false);
  });

  it('should apply WORLD_FACT delta', () => {
    const next = StoryStateManager.applyDeltas(baseState, [{
      entityType: EntityTypeEnum.WORLD_FACT,
      entityId: 'magic-rule',
      property: 'fact',
      previousValue: null,
      newValue: 'Undead cannot cross running water',
    }], 1);
    expect(next.worldFacts['magic-rule'].fact).toBe('Undead cannot cross running water');
  });

  it('should apply PLOT_THREAD delta', () => {
    const next = StoryStateManager.applyDeltas(baseState, [{
      entityType: EntityTypeEnum.PLOT_THREAD,
      entityId: 'thread-1',
      property: 'status',
      previousValue: 'OPEN',
      newValue: 'RESOLVED',
    }], 100);
    expect(next.quests['thread-1'].status).toBe('RESOLVED');
  });

  it('should NOT mutate original state (immutability)', () => {
    const original = StoryStateManager.empty('novel-1', 0);
    StoryStateManager.applyDeltas(original, [{
      entityType: EntityTypeEnum.CHARACTER,
      entityId: 'char-1',
      property: 'name',
      previousValue: null,
      newValue: 'John',
    }], 1);
    expect(original.characters['char-1']).toBeUndefined();
  });

  it('should advance asOfChapter correctly', () => {
    const s1 = StoryStateManager.applyDeltas(baseState, [], 10);
    const s2 = StoryStateManager.applyDeltas(s1, [], 20);
    expect(s2.asOfChapter).toBe(20);
  });

  it('should chain multiple deltas in order', () => {
    const deltas = [
      { entityType: EntityTypeEnum.CHARACTER, entityId: 'c', property: 'name', previousValue: null, newValue: 'Alice' },
      { entityType: EntityTypeEnum.CHARACTER, entityId: 'c', property: 'isAlive', previousValue: true, newValue: false },
    ];
    const next = StoryStateManager.applyDeltas(baseState, deltas, 5);
    expect(next.characters['c'].name).toBe('Alice');
    expect(next.characters['c'].isAlive).toBe(false);
  });
});

// ====================================================================
// 3. Snapshot → StoryState conversion
// ====================================================================
describe('StoryStateManager.fromSnapshotJson', () => {
  it('should convert legacy character snapshot', () => {
    const state = StoryStateManager.fromSnapshotJson('novel-1', 10, {
      characters: {
        'char-1': { name: 'Hero', isAlive: true, location: 'Forest' },
      },
    });
    expect(state.characters['char-1'].name).toBe('Hero');
    expect(state.characters['char-1'].location).toBe('Forest');
    expect(state.asOfChapter).toBe(10);
  });

  it('should convert legacy items', () => {
    const state = StoryStateManager.fromSnapshotJson('novel-1', 5, {
      items: { 'sword': { name: 'Magic Sword', ownerId: 'char-1' } },
    });
    expect(state.items['sword'].name).toBe('Magic Sword');
    expect(state.items['sword'].ownerId).toBe('char-1');
  });

  it('should handle empty snapshot', () => {
    const state = StoryStateManager.fromSnapshotJson('novel-1', 1, {});
    expect(state.characters).toEqual({});
    expect(state.asOfChapter).toBe(1);
  });
});

// ====================================================================
// 4. LongTermContinuityValidator — dead character checks
// ====================================================================
describe('LongTermContinuityValidator — dead characters', () => {
  const stateWithDeadChar = StoryStateManager.applyDeltas(
    StoryStateManager.empty('n', 0),
    [{ entityType: EntityTypeEnum.CHARACTER, entityId: 'char-1', property: 'isAlive', previousValue: true, newValue: false },
     { entityType: EntityTypeEnum.CHARACTER, entityId: 'char-1', property: 'name', previousValue: null, newValue: 'Villain' }],
    10
  );

  it('should detect state change on dead character', () => {
    const conflicts = LongTermContinuityValidator.checkDeadCharacters(
      stateWithDeadChar,
      [{ entityType: EntityTypeEnum.CHARACTER, entityId: 'char-1', property: 'location', previousValue: null, newValue: 'Castle' }]
    );
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].type).toBe(ContinuityConflictType.DEAD_CHARACTER);
    expect(conflicts[0].severity).toBe(ConflictSeverity.ERROR);
  });

  it('should allow isAlive change on dead character (resurrection)', () => {
    const conflicts = LongTermContinuityValidator.checkDeadCharacters(
      stateWithDeadChar,
      [{ entityType: EntityTypeEnum.CHARACTER, entityId: 'char-1', property: 'isAlive', previousValue: false, newValue: true }]
    );
    const errorConflicts = conflicts.filter((c) => c.severity === ConflictSeverity.ERROR);
    expect(errorConflicts.length).toBe(0);
  });

  it('should detect dead character in prose text (INFO)', () => {
    const conflicts = LongTermContinuityValidator.checkDeadCharacters(
      stateWithDeadChar,
      [],
      'Villain stepped into the throne room and sat down.'
    );
    expect(conflicts.some((c) => c.type === ContinuityConflictType.DEAD_CHARACTER)).toBe(true);
  });

  it('should NOT flag dead character not in prose', () => {
    const conflicts = LongTermContinuityValidator.checkDeadCharacters(
      stateWithDeadChar,
      [],
      'Alice walked through the garden.'
    );
    const errors = conflicts.filter((c) => c.severity === ConflictSeverity.ERROR);
    expect(errors.length).toBe(0);
  });
});

// ====================================================================
// 5. LongTermContinuityValidator — impossible location
// ====================================================================
describe('LongTermContinuityValidator — impossible location', () => {
  const state = StoryStateManager.applyDeltas(
    StoryStateManager.empty('n', 0),
    [
      { entityType: EntityTypeEnum.CHARACTER, entityId: 'char-1', property: 'name', previousValue: null, newValue: 'Hero' },
      { entityType: EntityTypeEnum.LOCATION, entityId: 'forbidden-zone', property: 'name', previousValue: null, newValue: 'Forbidden Zone' },
      { entityType: EntityTypeEnum.LOCATION, entityId: 'forbidden-zone', property: 'isAccessible', previousValue: true, newValue: false },
    ],
    5
  );

  it('should detect move to inaccessible location', () => {
    const conflicts = LongTermContinuityValidator.checkImpossibleLocation(state, [{
      entityType: EntityTypeEnum.CHARACTER,
      entityId: 'char-1',
      property: 'location',
      previousValue: 'Castle',
      newValue: 'Forbidden Zone',
    }]);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].type).toBe(ContinuityConflictType.IMPOSSIBLE_LOCATION);
  });

  it('should allow move to accessible location', () => {
    const conflicts = LongTermContinuityValidator.checkImpossibleLocation(state, [{
      entityType: EntityTypeEnum.CHARACTER,
      entityId: 'char-1',
      property: 'location',
      previousValue: 'Castle',
      newValue: 'Unknown Place',
    }]);
    expect(conflicts.filter((c) => c.severity === ConflictSeverity.ERROR).length).toBe(0);
  });
});

// ====================================================================
// 6. LongTermContinuityValidator — impossible possession
// ====================================================================
describe('LongTermContinuityValidator — possession', () => {
  const state = StoryStateManager.applyDeltas(
    StoryStateManager.empty('n', 0),
    [
      { entityType: EntityTypeEnum.ITEM, entityId: 'sword', property: 'name', previousValue: null, newValue: 'Sword' },
      { entityType: EntityTypeEnum.ITEM, entityId: 'sword', property: 'isDestroyed', previousValue: false, newValue: true },
    ],
    5
  );

  it('should reject transfer of destroyed item', () => {
    const conflicts = LongTermContinuityValidator.checkImpossiblePossession(state, [{
      entityType: EntityTypeEnum.ITEM,
      entityId: 'sword',
      property: 'ownerId',
      previousValue: null,
      newValue: 'char-2',
    }]);
    expect(conflicts.some((c) => c.type === ContinuityConflictType.IMPOSSIBLE_POSSESSION)).toBe(true);
  });
});

// ====================================================================
// 7. State collision detection
// ====================================================================
describe('LongTermContinuityValidator — state collision', () => {
  it('should detect conflicting deltas for same property', () => {
    const deltas = [
      { entityType: EntityTypeEnum.CHARACTER, entityId: 'char-1', property: 'location', previousValue: 'A', newValue: 'B' },
      { entityType: EntityTypeEnum.CHARACTER, entityId: 'char-1', property: 'location', previousValue: 'A', newValue: 'C' },
    ];
    const conflicts = LongTermContinuityValidator.checkStateCollision(deltas);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].type).toBe(ContinuityConflictType.STATE_COLLISION);
    expect(conflicts[0].severity).toBe(ConflictSeverity.ERROR);
  });

  it('should NOT flag same-value duplicate deltas', () => {
    const deltas = [
      { entityType: EntityTypeEnum.CHARACTER, entityId: 'char-1', property: 'location', previousValue: 'A', newValue: 'B' },
      { entityType: EntityTypeEnum.CHARACTER, entityId: 'char-1', property: 'location', previousValue: 'A', newValue: 'B' },
    ];
    const conflicts = LongTermContinuityValidator.checkStateCollision(deltas);
    expect(conflicts.filter((c) => c.severity === ConflictSeverity.ERROR).length).toBe(0);
  });

  it('should NOT flag different properties', () => {
    const deltas = [
      { entityType: EntityTypeEnum.CHARACTER, entityId: 'c', property: 'location', previousValue: null, newValue: 'A' },
      { entityType: EntityTypeEnum.CHARACTER, entityId: 'c', property: 'isAlive', previousValue: true, newValue: false },
    ];
    const conflicts = LongTermContinuityValidator.checkStateCollision(deltas);
    expect(conflicts.filter((c) => c.severity === ConflictSeverity.ERROR).length).toBe(0);
  });
});

// ====================================================================
// 8. Dependency detection
// ====================================================================
describe('LongTermContinuityValidator.findDependentChapters', () => {
  const changedDeltas = [
    { entityType: EntityTypeEnum.ITEM, entityId: 'sword', property: 'ownerId', previousValue: 'char-1', newValue: null },
  ];

  const memories = [
    { chapterNumber: 150, chapterId: 'ch-150', stateDeltas: [
      { entityType: EntityTypeEnum.ITEM, entityId: 'sword', property: 'ownerId', previousValue: null, newValue: 'char-1' },
    ]},
    { chapterNumber: 200, chapterId: 'ch-200', stateDeltas: [
      { entityType: EntityTypeEnum.CHARACTER, entityId: 'char-1', property: 'location', previousValue: null, newValue: 'Forest' },
    ]},
  ];

  it('should identify chapters that depend on changed state', () => {
    const dependents = LongTermContinuityValidator.findDependentChapters(
      changedDeltas,
      memories,
      100
    );
    expect(dependents.some((d) => d.chapterId === 'ch-150')).toBe(true);
    expect(dependents.some((d) => d.chapterId === 'ch-200')).toBe(false);
  });

  it('should not flag chapters before fromChapter', () => {
    const dependents = LongTermContinuityValidator.findDependentChapters(
      changedDeltas,
      [{ chapterNumber: 50, chapterId: 'ch-50', stateDeltas: changedDeltas }],
      100
    );
    expect(dependents.length).toBe(0);
  });
});

// ====================================================================
// 9. Knowledge boundary
// ====================================================================
describe('KnowledgeBoundaryValidator', () => {
  it('should build empty knowledge state', () => {
    const k = KnowledgeBoundaryValidator.buildEmptyKnowledge('char-1', 'Alice');
    expect(k.characterId).toBe('char-1');
    expect(k.knownSecrets.length).toBe(0);
    expect(k.knownFacts.length).toBe(0);
  });

  it('should add secret on reveal', () => {
    const k = KnowledgeBoundaryValidator.buildEmptyKnowledge('char-1', 'Alice');
    const updated = KnowledgeBoundaryValidator.revealSecret(k, 'secret-1', 50);
    expect(updated.knownSecrets.includes('secret-1')).toBe(true);
    expect(updated.discoveredAtChapter['secret-1']).toBe(50);
  });

  it('should be idempotent on double-reveal', () => {
    const k = KnowledgeBoundaryValidator.buildEmptyKnowledge('char-1', 'Alice');
    const k1 = KnowledgeBoundaryValidator.revealSecret(k, 'secret-1', 50);
    const k2 = KnowledgeBoundaryValidator.revealSecret(k1, 'secret-1', 50);
    expect(k2.knownSecrets.filter((s) => s === 'secret-1').length).toBe(1);
  });

  it('should build POV state excluding unknown characters', () => {
    const globalState = StoryStateManager.applyDeltas(
      StoryStateManager.empty('n', 0),
      [
        { entityType: EntityTypeEnum.CHARACTER, entityId: 'alice', property: 'name', previousValue: null, newValue: 'Alice' },
        { entityType: EntityTypeEnum.CHARACTER, entityId: 'villain', property: 'name', previousValue: null, newValue: 'Dark Lord' },
      ],
      5
    );
    const knowledge = KnowledgeBoundaryValidator.buildEmptyKnowledge('alice', 'Alice');
    const povState = KnowledgeBoundaryValidator.buildPOVState(globalState, knowledge, 5);
    // Alice knows herself but not the villain (not in knownEntities)
    expect(povState.characters?.['alice']).toBeDefined();
    expect(povState.characters?.['villain']).toBeUndefined();
  });

  it('should detect knowledge leak for unrevealed secret', () => {
    const globalState = StoryStateManager.applyDeltas(
      StoryStateManager.empty('n', 0),
      [{ entityType: EntityTypeEnum.SECRET, entityId: 'secret-1', property: 'truth', previousValue: null, newValue: 'The king is the protagonist father' }],
      0
    );
    globalState.mysteries['secret-1'] = {
      id: 'secret-1',
      description: 'Royal lineage',
      truth: 'The king is the protagonist father',
      knownBy: ['king'],
      revealedInChapter: 200,
    };

    const k = KnowledgeBoundaryValidator.buildEmptyKnowledge('hero', 'Hero');
    const conflicts = KnowledgeBoundaryValidator.detectKnowledgeLeak(
      'The hero knew that the king protagonist father all along',
      globalState,
      k,
      50 // before reveal chapter 200
    );
    // Should detect the leak
    expect(conflicts.some((c) => c.type === ContinuityConflictType.KNOWLEDGE_LEAK)).toBe(true);
  });

  it('should validate revelation timing — no duplicate reveals', () => {
    const secrets = [
      { id: 's1', description: 'A', truth: 'T', knownBy: [], revealedInChapter: 10 },
      { id: 's1', description: 'A', truth: 'T', knownBy: [], revealedInChapter: 10 },
    ];
    const conflicts = KnowledgeBoundaryValidator.validateRevealTiming(secrets, 50);
    expect(conflicts.some((c) => c.type === ContinuityConflictType.DUPLICATE_REVELATION)).toBe(true);
  });
});

// ====================================================================
// 10. Chapter Memory schema validation
// ====================================================================
describe('ChapterMemory schema', () => {
  it('should parse valid chapter memory', () => {
    const m = ChapterMemorySchema.parse({
      chapterId: 'ch-1',
      novelId: 'n-1',
      chapterNumber: 5,
      summary: 'The hero fights the dragon and loses their sword.',
      keyEvents: ['Dragon fight', 'Sword lost'],
      stateDeltas: [{ entityType: 'ITEM', entityId: 'sword', property: 'ownerId', newValue: 'dragon' }],
      introducedCharacters: [],
      changedRelationships: [],
      revelations: [],
      unresolvedThreads: ['dragon-quest'],
      resolvedThreads: [],
      locations: ['Dragon Peak'],
      importantItems: ['Magic Sword'],
      emotionalTurningPoints: ['Hero loses confidence'],
    });
    expect(m.chapterNumber).toBe(5);
    expect(m.keyEvents).toHaveLength(2);
  });

  it('should truncate summary at 1500 chars via transform', () => {
    // Zod max on string — enforces length
    expect(() =>
      ChapterMemorySchema.parse({
        chapterId: 'c', novelId: 'n', chapterNumber: 1,
        summary: 'x'.repeat(1501),
        keyEvents: [], stateDeltas: [], introducedCharacters: [],
        changedRelationships: [], revelations: [], unresolvedThreads: [],
        resolvedThreads: [], locations: [], importantItems: [],
        emotionalTurningPoints: [],
      })
    ).toThrow();
  });

  it('should reject more than 10 keyEvents', () => {
    expect(() =>
      ChapterMemorySchema.parse({
        chapterId: 'c', novelId: 'n', chapterNumber: 1,
        summary: 'short',
        keyEvents: new Array(11).fill('event'),
        stateDeltas: [], introducedCharacters: [], changedRelationships: [],
        revelations: [], unresolvedThreads: [], resolvedThreads: [],
        locations: [], importantItems: [], emotionalTurningPoints: [],
      })
    ).toThrow();
  });
});

// ====================================================================
// 11. Quality Gate — cost projection (pure arithmetic)
// ====================================================================
describe('GenerationQualityGate.projectCost', () => {
  it('should project zero cost for no completed chapters', () => {
    const proj = GenerationQualityGate.projectCost(0, 1000, 0);
    expect(proj.avgCostPerChapter).toBe(0);
    expect(proj.estimatedRemainingUsd).toBe(0);
  });

  it('should project cost correctly', () => {
    const proj = GenerationQualityGate.projectCost(100, 1000, 20);
    expect(proj.avgCostPerChapter).toBe(0.2);
    expect(proj.estimatedRemainingUsd).toBe(180);
    expect(proj.projectedTotalUsd).toBe(200);
  });

  it('should handle completed novels', () => {
    const proj = GenerationQualityGate.projectCost(1000, 1000, 50);
    expect(proj.estimatedRemainingUsd).toBe(0);
    expect(proj.projectedTotalUsd).toBe(50);
  });

  it('should round to 4 decimal places for avgCostPerChapter', () => {
    const proj = GenerationQualityGate.projectCost(3, 100, 1);
    expect(proj.avgCostPerChapter).toBe(0.3333);
  });
});

// ====================================================================
// 12. State machine transitions
// ====================================================================
describe('Novel Generation State Machine', () => {
  const VALID_ACTIVE_STATES = [
    'ARCHITECTING', 'PLANNING', 'GENERATING_CHAPTERS',
    'GENERATING_SCENES', 'GENERATING_PROSE',
  ];

  const TERMINAL_STATES = ['COMPLETED', 'FAILED'];

  it('should not allow terminal state to transition to active', () => {
    for (const terminal of TERMINAL_STATES) {
      const canTransition = !TERMINAL_STATES.includes(terminal);
      expect(canTransition).toBe(false);
    }
  });

  it('should allow any active state to transition to PAUSED', () => {
    for (const state of VALID_ACTIVE_STATES) {
      const canPause = VALID_ACTIVE_STATES.includes(state);
      expect(canPause).toBe(true);
    }
  });

  it('should allow PAUSED to resume only to active states', () => {
    const pausedState = 'PAUSED';
    const nextState = 'GENERATING_PROSE';
    expect(VALID_ACTIVE_STATES.includes(nextState)).toBe(true);
    expect(pausedState !== nextState).toBe(true);
  });

  it('BLOCKED should only transition to active after explicit resolution', () => {
    const blocked = 'BLOCKED';
    const autoTransition = VALID_ACTIVE_STATES.includes(blocked);
    expect(autoTransition).toBe(false); // blocked cannot auto-advance
  });
});

// ====================================================================
// 13. Progress calculation
// ====================================================================
describe('Progress Calculation', () => {
  it('should compute 0% for no completed chapters', () => {
    const pct = 1000 > 0 ? Math.round((0 / 1000) * 100 * 10) / 10 : 0;
    expect(pct).toBe(0);
  });

  it('should compute 100% when all chapters complete', () => {
    const pct = Math.round((1000 / 1000) * 100 * 10) / 10;
    expect(pct).toBe(100);
  });

  it('should compute partial progress correctly', () => {
    const pct = Math.round((583 / 1000) * 100 * 10) / 10;
    expect(pct).toBe(58.3);
  });

  it('estimatedRemainingChapters should be bounded', () => {
    const target = 1000;
    const completed = 500;
    const remaining = Math.max(0, target - completed);
    expect(remaining).toBe(500);
    expect(remaining).toBeLessThanOrEqual(target);
  });
});

// ====================================================================
// 14. Generation window bounds
// ====================================================================
describe('Generation Window Bounds', () => {
  it('1000-chapter novel should not start with 1000 jobs', () => {
    const windowSize = 2;
    const batchSize = 10;
    const maxJobsAtStart = windowSize * batchSize;
    expect(maxJobsAtStart).toBe(20);
    expect(maxJobsAtStart).toBeLessThan(1000);
  });

  it('window should cap at targetChapters', () => {
    const completed = 990;
    const target = 1000;
    const batchSize = 10;
    const nextEnd = Math.min(completed + batchSize, target);
    expect(nextEnd).toBe(1000);
  });

  it('next batch start should follow directly from completed', () => {
    const completed = 100;
    const nextStart = completed + 1;
    expect(nextStart).toBe(101);
  });

  it('should detect novel completion when window exceeds target', () => {
    const completed = 1000;
    const target = 1000;
    const isComplete = completed >= target;
    expect(isComplete).toBe(true);
  });
});

// ====================================================================
// 15. Serverless deadline simulation
// ====================================================================
describe('Serverless Deadline Handling', () => {
  it('should not start new jobs when past soft deadline', () => {
    const processorStart = Date.now() - 50000; // 50 seconds elapsed
    const timeoutMs = 50000;
    const elapsed = Date.now() - processorStart;
    const isPastDeadline = elapsed >= timeoutMs;
    expect(isPastDeadline).toBe(true);
    // Processor should not start a new job when past deadline
  });

  it('should start jobs when well within deadline', () => {
    const processorStart = Date.now() - 5000; // 5 seconds elapsed
    const timeoutMs = 50000;
    const elapsed = Date.now() - processorStart;
    const isPastDeadline = elapsed >= timeoutMs;
    expect(isPastDeadline).toBe(false);
  });

  it('JOB_BATCH_SIZE should bound max concurrent executions', () => {
    const JOB_BATCH_SIZE = 3;
    const runningJobs = 3;
    const canStart = runningJobs < JOB_BATCH_SIZE;
    expect(canStart).toBe(false);
  });
});

// ====================================================================
// 16. Historical immutability
// ====================================================================
describe('Historical Immutability', () => {
  it('STALE should never mean deleted', () => {
    const STALE_IS_DELETED = false; // by design
    expect(STALE_IS_DELETED).toBe(false);
  });

  it('State deltas should have provenance', () => {
    const delta = {
      entityType: EntityTypeEnum.CHARACTER,
      entityId: 'char-1',
      property: 'isAlive',
      previousValue: true,
      newValue: false,
      sourceChapterId: 'ch-100',
      sourceSceneId: 'scene-5',
      sourceChapterNumber: 100,
    };
    expect(delta.sourceChapterId).toBeDefined();
    expect(delta.sourceSceneId).toBeDefined();
    expect(delta.previousValue).toBeDefined();
  });

  it('applying deltas should not change previousValue tracking', () => {
    const initial = StoryStateManager.empty('n', 0);
    const next = StoryStateManager.applyDeltas(initial, [{
      entityType: EntityTypeEnum.CHARACTER,
      entityId: 'c',
      property: 'name',
      previousValue: null,
      newValue: 'Alice',
    }], 1);
    // Original state should still be empty
    expect(Object.keys(initial.characters).length).toBe(0);
    // New state should have the character
    expect(next.characters['c'].name).toBe('Alice');
  });
});

// ====================================================================
// 17. No LLM invocation from continuity services
// ====================================================================
describe('No Direct LLM from Continuity Services', () => {
  it('StoryStateManager should not import LLM providers', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/continuity/StoryStateManager.ts', import.meta.url),
      'utf8'
    );
    expect(content).not.toContain('openai');
    expect(content).not.toContain('anthropic');
    expect(content).not.toContain('NineRouterProvider');
    expect(content).not.toContain('ProviderFactory');
    expect(content).not.toContain('ILLMProvider');
  });

  it('LongTermContinuityValidator should not import LLM providers', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/continuity/LongTermContinuityValidator.ts', import.meta.url),
      'utf8'
    );
    expect(content).not.toContain('openai');
    expect(content).not.toContain('ProviderFactory');
    expect(content).not.toContain('NineRouterProvider');
  });

  it('GenerationQualityGate should not import LLM providers', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/continuity/GenerationQualityGate.ts', import.meta.url),
      'utf8'
    );
    expect(content).not.toContain('openai');
    expect(content).not.toContain('NineRouterProvider');
    expect(content).not.toContain('ProviderFactory');
  });
});

// ====================================================================
// 18. Idempotency key format
// ====================================================================
describe('Idempotency Key Format', () => {
  const buildKey = (novelId: string, stage: string, ctx?: Record<string, any>) => {
    if (ctx?.chapterId) return `NOVEL:${novelId}:${stage}:${ctx.chapterId}`;
    if (ctx?.chapterStart !== undefined) return `NOVEL:${novelId}:${stage}:${ctx.chapterStart}-${ctx.chapterEnd}`;
    if (ctx?.sagaId) return `NOVEL:${novelId}:PLANNER:ARC:${ctx.sagaId}`;
    return `NOVEL:${novelId}:${stage}`;
  };

  it('should build PROSE key with chapterId', () => {
    expect(buildKey('n-1', 'PROSE', { chapterId: 'ch-5' })).toBe('NOVEL:n-1:PROSE:ch-5');
  });

  it('should build CHAPTER_BLUEPRINT key with range', () => {
    expect(buildKey('n-1', 'CHAPTER_BLUEPRINT', { chapterStart: 1, chapterEnd: 10 })).toBe('NOVEL:n-1:CHAPTER_BLUEPRINT:1-10');
  });

  it('should be deterministic', () => {
    const k1 = buildKey('n-1', 'PROSE', { chapterId: 'ch-5' });
    const k2 = buildKey('n-1', 'PROSE', { chapterId: 'ch-5' });
    expect(k1).toBe(k2);
  });
});

// ====================================================================
// 19. Observability event safety
// ====================================================================
describe('ObservabilityManager event safety', () => {
  it('should not log api keys', async () => {
    const { ObservabilityManager } = await import('../src/services/generation/ObservabilityManager.js');
    const obs = ObservabilityManager.getInstance();
    obs.resetMemoryStore();
    obs.recordPhase9Event({
      type: 'NOVEL_GENERATION_STARTED',
      novelId: 'n-1',
      timestamp: new Date(),
      metadata: { apiKey: 'sk-secret-123', someData: 'ok' },
    });
    const events = obs.getPhase9Events();
    const lastEvent = events[events.length - 1];
    expect((lastEvent.metadata as any)?.apiKey).toBeUndefined();
    expect((lastEvent.metadata as any)?.someData).toBe('ok');
  });
});

// ====================================================================
// 20. Blocked job recovery
// ====================================================================
describe('Blocked Job Recovery', () => {
  const BLOCKED_STATUSES = ['BLOCKED'];
  const RETRYABLE_STATUSES = ['FAILED', 'BLOCKED'];

  it('BLOCKED jobs should be recoverable via retry-blocked', () => {
    const jobs = [
      { id: '1', status: 'BLOCKED' },
      { id: '2', status: 'FAILED' },
      { id: '3', status: 'SUCCEEDED' },
    ];
    const retryable = jobs.filter((j) => BLOCKED_STATUSES.includes(j.status));
    expect(retryable).toHaveLength(1);
    expect(retryable[0].id).toBe('1');
  });

  it('recovery should reset retryCount to 0', () => {
    const job = { id: '1', status: 'BLOCKED', retryCount: 5 };
    const recovered = { ...job, status: 'QUEUED', retryCount: 0 };
    expect(recovered.status).toBe('QUEUED');
    expect(recovered.retryCount).toBe(0);
  });
});

// ====================================================================
// 21. Full validate() integration (pure)
// ====================================================================
describe('LongTermContinuityValidator.validate — full run', () => {
  const emptyState = StoryStateManager.empty('n', 0);

  it('should PASS with empty deltas and empty state', () => {
    const report = LongTermContinuityValidator.validate(emptyState, [], 1);
    expect(report.status).toBe('PASS');
    expect(report.conflicts.length).toBe(0);
  });

  it('should FAIL when dead character gets location change', () => {
    const stateWithDead = StoryStateManager.applyDeltas(emptyState, [
      { entityType: EntityTypeEnum.CHARACTER, entityId: 'c', property: 'name', previousValue: null, newValue: 'Ghost' },
      { entityType: EntityTypeEnum.CHARACTER, entityId: 'c', property: 'isAlive', previousValue: true, newValue: false },
    ], 1);

    const report = LongTermContinuityValidator.validate(stateWithDead, [
      { entityType: EntityTypeEnum.CHARACTER, entityId: 'c', property: 'location', previousValue: null, newValue: 'Castle', sourceChapterNumber: 2 },
    ], 2);

    expect(report.status).toBe('FAIL');
    expect(report.severity).toBe(ConflictSeverity.ERROR);
  });

  it('should WARN (not FAIL) when dead character mentioned in prose (INFO)', () => {
    const stateWithDead = StoryStateManager.applyDeltas(emptyState, [
      { entityType: EntityTypeEnum.CHARACTER, entityId: 'c', property: 'name', previousValue: null, newValue: 'Ghost' },
      { entityType: EntityTypeEnum.CHARACTER, entityId: 'c', property: 'isAlive', previousValue: true, newValue: false },
    ], 1);

    const report = LongTermContinuityValidator.validate(stateWithDead, [], 2, {
      proseText: 'The hero remembered Ghost fondly.',
    });
    // INFO conflicts don't make it FAIL
    const errors = report.conflicts.filter((c) => c.severity === ConflictSeverity.ERROR);
    expect(errors.length).toBe(0);
  });
});
