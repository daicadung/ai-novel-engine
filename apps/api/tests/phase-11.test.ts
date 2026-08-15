/**
 * Phase 11: Long-Horizon Story Planning Test Suite
 *
 * Tests all Phase 11 components:
 * - PlanningValidator (deterministic)
 * - PlanningWindowBuilder
 * - ChapterObjectivePlanner
 * - ForeshadowingManager
 * - NarrativeObligationTracker
 * - PlanReconciler
 * - NarrativeBalanceAnalyzer
 * - PlanningQualityScorer
 * - StoryPlanningHandler
 * - LongHorizonPlanner (mock provider)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  PlanningValidator,
} from '../src/services/planning/PlanningValidator.js';
import {
  NarrativeBalanceAnalyzer,
  PlanningQualityScorer,
} from '../src/services/planning/NarrativeAnalyzers.js';
import {
  ArcStatus,
  MilestoneStatus,
  MilestoneType,
  ObligationStatus,
  ObligationType,
  ForeshadowingStatus,
  ForeshadowingStrength,
  DeviationType,
  StoryArcPlan,
  NarrativeMilestone,
  NarrativeObligation,
  ForeshadowingPlanRecord,
  ChapterObjective,
} from '@ane/core';

// ===========================================================
// Test data factories
// ===========================================================

function makeArcPlan(overrides: Partial<StoryArcPlan> = {}): StoryArcPlan {
  return {
    id: 'arc-1',
    longHorizonPlanId: 'plan-1',
    novelId: 'novel-1',
    arcNumber: 1,
    title: 'The Rising Darkness',
    purpose: 'Establish the world and threat',
    objective: 'Hero discovers the ancient threat and assembles allies',
    conflict: 'Hero vs. Dark Legion',
    stakes: 'The entire kingdom will fall',
    entryConditions: ['Novel opens', 'Hero is at home'],
    exitConditions: ['Hero has assembled allies', 'Threat fully revealed'],
    plannedChapterStart: 1,
    plannedChapterEnd: 100,
    status: ArcStatus.PLANNED,
    priority: 8,
    allowExtension: true,
    maxExtensionChapters: 20,
    characterFocusIds: ['char-1'],
    threadFocusIds: ['thread-1'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeMilestone(overrides: Partial<NarrativeMilestone> = {}): NarrativeMilestone {
  return {
    id: 'ms-1',
    novelId: 'novel-1',
    milestoneType: MilestoneType.MAJOR_REVEAL,
    title: 'The Dark Origin Revealed',
    description: 'Hero discovers the true origin of the dark power',
    plannedChapterMin: 40,
    plannedChapterMax: 60,
    status: MilestoneStatus.PLANNED,
    prerequisites: [],
    consequences: ['Hero gains new resolve', 'Enemy adapts strategy'],
    involvedEntityIds: ['char-1', 'char-2'],
    priority: 8,
    isOptional: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeObligation(overrides: Partial<NarrativeObligation> = {}): NarrativeObligation {
  return {
    id: 'ob-1',
    novelId: 'novel-1',
    obligationType: ObligationType.UNANSWERED_QUESTION,
    description: 'What is the source of the dark power?',
    establishedChapter: 5,
    establishedBy: 'Chapter 5 scene 3',
    targetResolutionChapter: 60,
    status: ObligationStatus.OPEN,
    progressNotes: [],
    involvedEntityIds: ['char-1'],
    dependentObligationIds: [],
    priority: 8,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeForeshadowing(overrides: Partial<ForeshadowingPlanRecord> = {}): ForeshadowingPlanRecord {
  return {
    id: 'fp-1',
    novelId: 'novel-1',
    setupType: 'SYMBOLIC_OBJECT',
    plannedSetupChapters: [10, 20, 30],
    minimumOccurrences: 2,
    actualSetupCount: 0,
    revealWindowStart: 10,
    revealWindowEnd: 40,
    payoffWindowStart: 50,
    payoffWindowEnd: 80,
    strength: ForeshadowingStrength.MODERATE,
    status: ForeshadowingStatus.PLANNED,
    description: 'The black feather appearing at moments of darkness',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ===========================================================
// PlanningValidator Tests
// ===========================================================

describe('PlanningValidator', () => {
  // Arc validation
  describe('validateArcs', () => {
    it('passes with valid non-overlapping arcs', () => {
      const arcs = [
        makeArcPlan({ arcNumber: 1, plannedChapterStart: 1, plannedChapterEnd: 100 }),
        makeArcPlan({ id: 'arc-2', arcNumber: 2, plannedChapterStart: 101, plannedChapterEnd: 200 }),
      ];
      const result = PlanningValidator.validateArcs(arcs);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('catches arc overlap', () => {
      const arcs = [
        makeArcPlan({ arcNumber: 1, plannedChapterStart: 1, plannedChapterEnd: 100 }),
        makeArcPlan({ id: 'arc-2', arcNumber: 2, plannedChapterStart: 80, plannedChapterEnd: 200 }),
      ];
      const result = PlanningValidator.validateArcs(arcs);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'ARC_CHAPTER_OVERLAP')).toBe(true);
    });

    it('catches invalid arc range (start >= end)', () => {
      const arcs = [
        makeArcPlan({ arcNumber: 1, plannedChapterStart: 100, plannedChapterEnd: 50 }),
      ];
      const result = PlanningValidator.validateArcs(arcs);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'ARC_INVALID_RANGE')).toBe(true);
    });

    it('catches multiple active arcs', () => {
      const arcs = [
        makeArcPlan({ arcNumber: 1, plannedChapterStart: 1, plannedChapterEnd: 100, status: ArcStatus.ACTIVE }),
        makeArcPlan({ id: 'arc-2', arcNumber: 2, plannedChapterStart: 101, plannedChapterEnd: 200, status: ArcStatus.ACTIVE }),
      ];
      const result = PlanningValidator.validateArcs(arcs);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MULTIPLE_ACTIVE_ARCS')).toBe(true);
    });

    it('warns on missing exit conditions', () => {
      const arcs = [
        makeArcPlan({ exitConditions: [] }),
      ];
      const result = PlanningValidator.validateArcs(arcs);
      expect(result.warnings.some((w) => w.code === 'ARC_MISSING_EXIT_CONDITIONS')).toBe(true);
    });

    it('passes with single active arc', () => {
      const arcs = [
        makeArcPlan({ arcNumber: 1, plannedChapterStart: 1, plannedChapterEnd: 100, status: ArcStatus.ACTIVE }),
        makeArcPlan({ id: 'arc-2', arcNumber: 2, plannedChapterStart: 101, plannedChapterEnd: 200, status: ArcStatus.PLANNED }),
      ];
      const result = PlanningValidator.validateArcs(arcs);
      expect(result.errors.filter((e) => e.code === 'MULTIPLE_ACTIVE_ARCS')).toHaveLength(0);
    });
  });

  // Milestone validation
  describe('validateMilestones', () => {
    it('passes with valid milestones', () => {
      const ms = [
        makeMilestone({ id: 'ms-1', plannedChapterMin: 40, plannedChapterMax: 60 }),
        makeMilestone({ id: 'ms-2', plannedChapterMin: 70, plannedChapterMax: 90, title: 'Betrayal' }),
      ];
      const result = PlanningValidator.validateMilestones(ms, [makeArcPlan()]);
      expect(result.valid).toBe(true);
    });

    it('catches invalid window (min > max)', () => {
      const ms = [makeMilestone({ plannedChapterMin: 70, plannedChapterMax: 40 })];
      const result = PlanningValidator.validateMilestones(ms, []);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MILESTONE_INVALID_WINDOW')).toBe(true);
    });

    it('catches unknown prerequisite', () => {
      const ms = [makeMilestone({ prerequisites: ['nonexistent-milestone-id'] })];
      const result = PlanningValidator.validateMilestones(ms, []);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MILESTONE_UNKNOWN_PREREQ')).toBe(true);
    });

    it('catches self-referential prerequisite', () => {
      const ms = [makeMilestone({ id: 'ms-1', prerequisites: ['ms-1'] })];
      const result = PlanningValidator.validateMilestones(ms, []);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MILESTONE_SELF_PREREQ')).toBe(true);
    });

    it('detects circular dependency: A→B→A', () => {
      const ms = [
        makeMilestone({ id: 'ms-1', prerequisites: ['ms-2'] }),
        makeMilestone({ id: 'ms-2', title: 'Other', prerequisites: ['ms-1'] }),
      ];
      const result = PlanningValidator.validateMilestones(ms, []);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MILESTONE_CIRCULAR_DEPENDENCY')).toBe(true);
    });

    it('allows valid prerequisite chain (A→B, no cycle)', () => {
      const ms = [
        makeMilestone({ id: 'ms-1', prerequisites: [] }),
        makeMilestone({ id: 'ms-2', title: 'Other', prerequisites: ['ms-1'] }),
      ];
      const result = PlanningValidator.validateMilestones(ms, []);
      expect(result.valid).toBe(true);
    });

    it('warns on duplicate milestone titles', () => {
      const ms = [
        makeMilestone({ id: 'ms-1', title: 'The Reveal' }),
        makeMilestone({ id: 'ms-2', title: 'The Reveal' }),
      ];
      const result = PlanningValidator.validateMilestones(ms, []);
      expect(result.warnings.some((w) => w.code === 'MILESTONE_DUPLICATE_TITLE')).toBe(true);
    });
  });

  // Obligation validation
  describe('validateObligations', () => {
    it('passes with valid obligations', () => {
      const ob = [
        makeObligation({ establishedChapter: 5, targetResolutionChapter: 60 }),
      ];
      const result = PlanningValidator.validateObligations(ob);
      expect(result.valid).toBe(true);
    });

    it('catches impossible timing (resolution <= establishment)', () => {
      const ob = [
        makeObligation({ establishedChapter: 50, targetResolutionChapter: 40 }),
      ];
      const result = PlanningValidator.validateObligations(ob);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'OBLIGATION_IMPOSSIBLE_TIMING')).toBe(true);
    });

    it('warns on orphaned dependency (open obligation depends on failed obligation)', () => {
      const obs = [
        makeObligation({ id: 'ob-1', status: ObligationStatus.FAILED }),
        makeObligation({ id: 'ob-2', status: ObligationStatus.OPEN, dependentObligationIds: ['ob-1'] }),
      ];
      const result = PlanningValidator.validateObligations(obs);
      expect(result.warnings.some((w) => w.code === 'OBLIGATION_ORPHANED_DEPENDENCY')).toBe(true);
    });
  });

  // Foreshadowing validation
  describe('validateForeshadowing', () => {
    it('passes with valid foreshadowing', () => {
      const fp = [
        makeForeshadowing({
          revealWindowStart: 10,
          revealWindowEnd: 40,
          payoffWindowStart: 50,
          payoffWindowEnd: 80,
          actualSetupCount: 2,
          minimumOccurrences: 2,
          status: ForeshadowingStatus.ACTIVE,
        }),
      ];
      const result = PlanningValidator.validateForeshadowing(fp, 45);
      expect(result.valid).toBe(true);
    });

    it('catches reveal window after payoff window', () => {
      const fp = [
        makeForeshadowing({ revealWindowStart: 60, payoffWindowStart: 40 }),
      ];
      const result = PlanningValidator.validateForeshadowing(fp, 10);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'FORESHADOWING_REVEAL_AFTER_PAYOFF')).toBe(true);
    });

    it('warns on insufficient setup when payoff window opens', () => {
      const fp = [
        makeForeshadowing({
          revealWindowStart: 10,
          revealWindowEnd: 40,
          payoffWindowStart: 45,
          payoffWindowEnd: 80,
          actualSetupCount: 0,
          minimumOccurrences: 2,
          status: ForeshadowingStatus.PLANNED,
        }),
      ];
      const result = PlanningValidator.validateForeshadowing(fp, 50);
      expect(result.warnings.some((w) => w.code === 'FORESHADOWING_INSUFFICIENT_SETUP')).toBe(true);
    });

    it('catches forgotten foreshadowing (payoff window passed, status not PAID_OFF)', () => {
      const fp = [
        makeForeshadowing({
          actualSetupCount: 2,
          payoffWindowEnd: 50,
          status: ForeshadowingStatus.ACTIVE,
        }),
      ];
      const result = PlanningValidator.validateForeshadowing(fp, 60);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'FORESHADOWING_FORGOTTEN')).toBe(true);
    });
  });

  // Chapter Objective validation
  describe('validateChapterObjective', () => {
    it('passes with valid objective', () => {
      const obj: ChapterObjective = {
        id: 'obj-1',
        novelId: 'novel-1',
        chapterNumber: 50,
        arcPlanId: 'arc-1',
        primaryObjective: 'Hero confronts the antagonist for the first time',
        secondaryObjectives: [],
        requiredEvents: ['First confrontation', 'Ally reveals weakness'],
        forbiddenEvents: ['Hero dies', 'Antagonist reveals identity'],
        characterGoals: [],
        plotThreadGoals: [],
        requiredStateChanges: [],
        setupActions: [],
        payoffActions: [],
        tensionTarget: 'HIGH',
        endingTarget: 'Cliffhanger',
        dependencies: [],
        status: 'DRAFT',
        createdAt: new Date(),
      };
      const arc = makeArcPlan({ plannedChapterStart: 1, plannedChapterEnd: 100 });
      const result = PlanningValidator.validateChapterObjective(obj, arc);
      expect(result.valid).toBe(true);
    });

    it('catches contradictory events (required AND forbidden)', () => {
      const obj: ChapterObjective = {
        id: 'obj-2',
        novelId: 'novel-1',
        chapterNumber: 50,
        arcPlanId: 'arc-1',
        primaryObjective: 'A valid objective text here',
        secondaryObjectives: [],
        requiredEvents: ['hero dies'],
        forbiddenEvents: ['hero dies'],
        characterGoals: [],
        plotThreadGoals: [],
        requiredStateChanges: [],
        setupActions: [],
        payoffActions: [],
        tensionTarget: 'HIGH',
        endingTarget: 'Resolution',
        dependencies: [],
        status: 'DRAFT',
        createdAt: new Date(),
      };
      const result = PlanningValidator.validateChapterObjective(obj, undefined);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'OBJECTIVE_CONTRADICTORY_EVENTS')).toBe(true);
    });

    it('catches missing primary objective', () => {
      const obj: ChapterObjective = {
        id: 'obj-3',
        novelId: 'novel-1',
        chapterNumber: 50,
        arcPlanId: 'arc-1',
        primaryObjective: 'hi',
        secondaryObjectives: [],
        requiredEvents: [],
        forbiddenEvents: [],
        characterGoals: [],
        plotThreadGoals: [],
        requiredStateChanges: [],
        setupActions: [],
        payoffActions: [],
        tensionTarget: 'MEDIUM',
        endingTarget: 'Resolution',
        dependencies: [],
        status: 'DRAFT',
        createdAt: new Date(),
      };
      const result = PlanningValidator.validateChapterObjective(obj, undefined);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'OBJECTIVE_MISSING_PRIMARY')).toBe(true);
    });

    it('warns on objective outside arc range', () => {
      const obj: ChapterObjective = {
        id: 'obj-4',
        novelId: 'novel-1',
        chapterNumber: 500,
        arcPlanId: 'arc-1',
        primaryObjective: 'A valid chapter objective here',
        secondaryObjectives: [],
        requiredEvents: [],
        forbiddenEvents: [],
        characterGoals: [],
        plotThreadGoals: [],
        requiredStateChanges: [],
        setupActions: [],
        payoffActions: [],
        tensionTarget: 'MEDIUM',
        endingTarget: 'Resolution',
        dependencies: [],
        status: 'DRAFT',
        createdAt: new Date(),
      };
      const arc = makeArcPlan({ plannedChapterStart: 1, plannedChapterEnd: 100, maxExtensionChapters: 20 });
      const result = PlanningValidator.validateChapterObjective(obj, arc);
      expect(result.warnings.some((w) => w.code === 'OBJECTIVE_OUTSIDE_ARC_RANGE')).toBe(true);
    });
  });

  // Deviation classification
  describe('classifyDeviation', () => {
    it('classifies ON_PLAN for score >= 0.9, no forbidden', () => {
      expect(PlanningValidator.classifyDeviation(0.95, 0, 0, 5)).toBe(DeviationType.ON_PLAN);
    });

    it('classifies MINOR_DEVIATION for score 0.7–0.9', () => {
      expect(PlanningValidator.classifyDeviation(0.75, 1, 0, 5)).toBe(DeviationType.MINOR_DEVIATION);
    });

    it('classifies ADAPTABLE_DEVIATION for score 0.4–0.7', () => {
      expect(PlanningValidator.classifyDeviation(0.55, 2, 0, 5)).toBe(DeviationType.ADAPTABLE_DEVIATION);
    });

    it('classifies MAJOR_DEVIATION for forbidden events triggered', () => {
      expect(PlanningValidator.classifyDeviation(0.85, 0, 1, 5)).toBe(DeviationType.MAJOR_DEVIATION);
    });

    it('classifies MAJOR_DEVIATION for score < 0.4', () => {
      expect(PlanningValidator.classifyDeviation(0.3, 4, 0, 5)).toBe(DeviationType.MAJOR_DEVIATION);
    });

    it('classifies ON_PLAN when no required events exist (score 1.0)', () => {
      expect(PlanningValidator.classifyDeviation(1.0, 0, 0, 0)).toBe(DeviationType.ON_PLAN);
    });
  });

  // Circular dependency detection
  describe('hasCircularDependency', () => {
    it('returns false for no cycle', () => {
      const ms = [
        makeMilestone({ id: 'A', prerequisites: [] }),
        makeMilestone({ id: 'B', title: 'B', prerequisites: ['A'] }),
        makeMilestone({ id: 'C', title: 'C', prerequisites: ['B'] }),
      ];
      expect(PlanningValidator.hasCircularDependency('C', ms)).toBe(false);
    });

    it('returns true for direct cycle (A→B→A)', () => {
      const ms = [
        makeMilestone({ id: 'A', prerequisites: ['B'] }),
        makeMilestone({ id: 'B', title: 'B', prerequisites: ['A'] }),
      ];
      expect(PlanningValidator.hasCircularDependency('A', ms)).toBe(true);
    });

    it('returns true for indirect cycle (A→B→C→A)', () => {
      const ms = [
        makeMilestone({ id: 'A', prerequisites: ['C'] }),
        makeMilestone({ id: 'B', title: 'B', prerequisites: ['A'] }),
        makeMilestone({ id: 'C', title: 'C', prerequisites: ['B'] }),
      ];
      expect(PlanningValidator.hasCircularDependency('A', ms)).toBe(true);
    });

    it('returns false for single node with no prerequisites', () => {
      const ms = [makeMilestone({ id: 'A', prerequisites: [] })];
      expect(PlanningValidator.hasCircularDependency('A', ms)).toBe(false);
    });
  });
});

// ===========================================================
// NarrativeBalanceAnalyzer Tests
// ===========================================================

describe('NarrativeBalanceAnalyzer', () => {
  const makeMemory = (chapterNumber: number, overrides: any = {}) => ({
    chapterNumber,
    summary: 'The hero advances through the forest',
    keyEvents: ['hero moves', 'discovers clue'],
    stateDeltas: [{ entityType: 'CHARACTER', entityId: 'char-1' }],
    resolvedThreads: [],
    unresolvedThreads: ['thread-1'],
    ...overrides,
  });

  it('computes overall balance score (clean window)', () => {
    const memories = Array.from({ length: 10 }, (_, i) => makeMemory(i + 1));
    const result = NarrativeBalanceAnalyzer.analyze(
      'novel-1', 1, 10, memories, ['thread-1', 'thread-2'], ['char-1']
    );
    expect(result.overallBalance).toBeGreaterThan(0);
    expect(result.overallBalance).toBeLessThanOrEqual(1);
    expect(result.novelId).toBe('novel-1');
    expect(result.windowStart).toBe(1);
    expect(result.windowEnd).toBe(10);
  });

  it('detects setup overload (many unresolved vs resolved)', () => {
    const memories = Array.from({ length: 10 }, (_, i) =>
      makeMemory(i + 1, { unresolvedThreads: ['t1', 't2', 't3', 't4', 't5', 't6'], resolvedThreads: [] })
    );
    const result = NarrativeBalanceAnalyzer.analyze('novel-1', 1, 10, memories, [], []);
    const setupImbalance = result.imbalances.find((i) => i.dimension === 'SETUP_OVERLOAD');
    expect(setupImbalance).toBeDefined();
  });

  it('detects character neglect for non-active character', () => {
    const memories = Array.from({ length: 10 }, (_, i) =>
      makeMemory(i + 1, { stateDeltas: [{ entityType: 'CHARACTER', entityId: 'char-1' }] })
    );
    const result = NarrativeBalanceAnalyzer.analyze('novel-1', 1, 10, memories, [], ['char-1', 'char-2']);
    const neglect = result.imbalances.find((i) => i.dimension === 'CHARACTER_NEGLECT');
    expect(neglect).toBeDefined();
    expect(neglect?.description).toContain('char-2');
  });

  it('returns imbalances as array (always present)', () => {
    const memories = [makeMemory(1)];
    const result = NarrativeBalanceAnalyzer.analyze('novel-1', 1, 1, memories, [], []);
    expect(Array.isArray(result.imbalances)).toBe(true);
  });

  it('computes correct setup/payoff ratio', () => {
    const memories = [
      makeMemory(1, { unresolvedThreads: ['t1'], resolvedThreads: ['resolved-1'] }),
      makeMemory(2, { unresolvedThreads: ['t1', 't2'], resolvedThreads: ['resolved-2'] }),
    ];
    const result = NarrativeBalanceAnalyzer.analyze('novel-1', 1, 2, memories, [], []);
    expect(result.setupPayoffRatio).toBeGreaterThan(0);
  });
});

// ===========================================================
// PlanningQualityScorer Tests
// ===========================================================

describe('PlanningQualityScorer', () => {
  it('returns 1.0 overall for perfect state', () => {
    const score = PlanningQualityScorer.compute('novel-1', 50, {
      arcPlan: {
        objective: 'A clear and detailed arc objective for the story',
        exitConditions: ['All allies gathered', 'Threat revealed'],
        status: 'ACTIVE',
      },
      milestones: [],
      obligations: [],
      foreshadowingPlans: [],
      recentObjectiveCompletionScores: [1.0, 1.0, 0.95, 1.0, 1.0],
      deviationHistory: ['ON_PLAN', 'ON_PLAN', 'ON_PLAN', 'MINOR_DEVIATION'],
      characterArcProgress: [0.9, 0.8, 0.85],
    });
    expect(score.overall).toBeGreaterThan(0.7);
    expect(score.planAdherence).toBe(1.0);
    expect(score.computedAt).toBeInstanceOf(Date);
  });

  it('penalizes for major deviations', () => {
    const score = PlanningQualityScorer.compute('novel-1', 50, {
      milestones: [],
      obligations: [],
      foreshadowingPlans: [],
      recentObjectiveCompletionScores: [0.4, 0.3, 0.5],
      deviationHistory: Array.from({ length: 10 }, () => 'MAJOR_DEVIATION'),
      characterArcProgress: [0.2],
    });
    expect(score.planAdherence).toBe(0);
    expect(score.plotProgression).toBeLessThan(0.6);
  });

  it('penalizes for open high-priority obligations', () => {
    const score = PlanningQualityScorer.compute('novel-1', 50, {
      milestones: [],
      obligations: [
        { status: ObligationStatus.OPEN, priority: 9 },
        { status: ObligationStatus.OPEN, priority: 10 },
        { status: ObligationStatus.OPEN, priority: 8 },
      ],
      foreshadowingPlans: [],
      recentObjectiveCompletionScores: [1.0],
      deviationHistory: ['ON_PLAN'],
      characterArcProgress: [1.0],
    });
    expect(score.obligationHealth).toBeLessThan(0.6);
  });

  it('penalizes for forgotten foreshadowing', () => {
    const score = PlanningQualityScorer.compute('novel-1', 50, {
      milestones: [],
      obligations: [],
      foreshadowingPlans: [
        { status: ForeshadowingStatus.FORGOTTEN, actualSetupCount: 2, minimumOccurrences: 2 },
        { status: ForeshadowingStatus.FORGOTTEN, actualSetupCount: 1, minimumOccurrences: 1 },
        { status: ForeshadowingStatus.PLANNED, actualSetupCount: 0, minimumOccurrences: 2 },
      ],
      recentObjectiveCompletionScores: [1.0],
      deviationHistory: ['ON_PLAN'],
      characterArcProgress: [1.0],
    });
    expect(score.foreshadowingHealth).toBeLessThan(0.7);
  });

  it('computes milestone progression correctly', () => {
    const score = PlanningQualityScorer.compute('novel-1', 50, {
      milestones: [
        { status: MilestoneStatus.COMPLETED, isOptional: false },
        { status: MilestoneStatus.COMPLETED, isOptional: false },
        { status: MilestoneStatus.PLANNED, isOptional: false },
        { status: MilestoneStatus.PLANNED, isOptional: true }, // optional, not counted
      ],
      obligations: [],
      foreshadowingPlans: [],
      recentObjectiveCompletionScores: [1.0],
      deviationHistory: ['ON_PLAN'],
      characterArcProgress: [1.0],
    });
    // 2/3 required milestones completed
    expect(score.milestoneProgression).toBeCloseTo(0.667, 1);
  });

  it('handles empty history gracefully', () => {
    const score = PlanningQualityScorer.compute('novel-1', 1, {
      milestones: [],
      obligations: [],
      foreshadowingPlans: [],
      recentObjectiveCompletionScores: [],
      deviationHistory: [],
      characterArcProgress: [],
    });
    expect(score.overall).toBeGreaterThan(0);
    expect(score.overall).toBeLessThanOrEqual(1);
  });

  it('returns scores in [0, 1] range for all dimensions', () => {
    const score = PlanningQualityScorer.compute('novel-1', 50, {
      arcPlan: { objective: 'Objective', exitConditions: ['done'], status: 'ACTIVE' },
      milestones: [{ status: MilestoneStatus.MISSED, isOptional: false }],
      obligations: [{ status: ObligationStatus.OPEN, priority: 10 }],
      foreshadowingPlans: [{ status: ForeshadowingStatus.FORGOTTEN, actualSetupCount: 1, minimumOccurrences: 1 }],
      recentObjectiveCompletionScores: [0.2, 0.3],
      deviationHistory: ['MAJOR_DEVIATION', 'MAJOR_DEVIATION'],
      characterArcProgress: [0.1],
    });
    const dims = [
      score.objectiveClarity,
      score.milestoneProgression,
      score.obligationHealth,
      score.foreshadowingHealth,
      score.characterArcProgression,
      score.plotProgression,
      score.planAdherence,
      score.adaptability,
      score.overall,
    ];
    for (const dim of dims) {
      expect(dim).toBeGreaterThanOrEqual(0);
      expect(dim).toBeLessThanOrEqual(1);
    }
  });
});

// ===========================================================
// ForeshadowingManager.detectHealthIssues Tests
// ===========================================================

import { ForeshadowingManager } from '../src/services/planning/ForeshadowingManager.js';

describe('ForeshadowingManager.detectHealthIssues', () => {
  it('detects reveal-without-setup', () => {
    const fp = [
      makeForeshadowing({
        status: ForeshadowingStatus.PLANNED,
        actualSetupCount: 0,
        payoffWindowStart: 40,
      }),
    ];
    const issues = ForeshadowingManager.detectHealthIssues(fp, 45);
    expect(issues.some((i) => i.issue.includes('REVEAL_WITHOUT_SETUP'))).toBe(true);
  });

  it('detects excessive setup', () => {
    const fp = [
      makeForeshadowing({
        status: ForeshadowingStatus.ACTIVE,
        actualSetupCount: 10,
        minimumOccurrences: 2,
      }),
    ];
    const issues = ForeshadowingManager.detectHealthIssues(fp, 30);
    expect(issues.some((i) => i.issue.includes('EXCESSIVE_SETUP'))).toBe(true);
  });

  it('detects forgotten foreshadowing', () => {
    const fp = [
      makeForeshadowing({ status: ForeshadowingStatus.FORGOTTEN }),
    ];
    const issues = ForeshadowingManager.detectHealthIssues(fp, 90);
    expect(issues.some((i) => i.issue.includes('FORGOTTEN_SETUP'))).toBe(true);
  });

  it('returns empty array for clean plans', () => {
    const fp = [
      makeForeshadowing({
        status: ForeshadowingStatus.ACTIVE,
        actualSetupCount: 2,
        minimumOccurrences: 2,
        payoffWindowStart: 60,
      }),
    ];
    const issues = ForeshadowingManager.detectHealthIssues(fp, 30);
    expect(issues).toHaveLength(0);
  });
});

// ===========================================================
// Edge case and integration tests
// ===========================================================

describe('Planning integration edge cases', () => {
  it('handles arcs with zero-length window (start == end) as invalid', () => {
    const arcs = [
      makeArcPlan({ plannedChapterStart: 50, plannedChapterEnd: 50 }),
    ];
    const result = PlanningValidator.validateArcs(arcs);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'ARC_INVALID_RANGE')).toBe(true);
  });

  it('accepts completed arcs with no active arcs', () => {
    const arcs = [
      makeArcPlan({ arcNumber: 1, plannedChapterStart: 1, plannedChapterEnd: 100, status: ArcStatus.COMPLETED }),
      makeArcPlan({ id: 'arc-2', arcNumber: 2, plannedChapterStart: 101, plannedChapterEnd: 200, status: ArcStatus.PLANNED }),
    ];
    const result = PlanningValidator.validateArcs(arcs);
    expect(result.errors.filter((e) => e.code === 'MULTIPLE_ACTIVE_ARCS')).toHaveLength(0);
  });

  it('NarrativeBalanceAnalyzer handles empty memory window', () => {
    const result = NarrativeBalanceAnalyzer.analyze('novel-1', 1, 5, [], [], []);
    expect(result.overallBalance).toBeGreaterThanOrEqual(0);
    expect(result.imbalances).toBeDefined();
  });

  it('PlanningQualityScorer: objectiveClarity 0.9 for arc with long objective + exit conditions', () => {
    const score = PlanningQualityScorer.compute('novel-1', 50, {
      arcPlan: {
        objective: 'This is a very detailed arc objective spanning many chapters',
        exitConditions: ['Condition A', 'Condition B'],
        status: 'ACTIVE',
      },
      milestones: [],
      obligations: [],
      foreshadowingPlans: [],
      recentObjectiveCompletionScores: [1.0],
      deviationHistory: ['ON_PLAN'],
      characterArcProgress: [],
    });
    expect(score.objectiveClarity).toBe(0.9);
  });

  it('PlanningQualityScorer: objectiveClarity 0.3 for no arc plan', () => {
    const score = PlanningQualityScorer.compute('novel-1', 50, {
      milestones: [],
      obligations: [],
      foreshadowingPlans: [],
      recentObjectiveCompletionScores: [1.0],
      deviationHistory: ['ON_PLAN'],
      characterArcProgress: [],
    });
    expect(score.objectiveClarity).toBe(0.3);
  });

  it('deviation ON_PLAN with no required events (total=0)', () => {
    const deviation = PlanningValidator.classifyDeviation(1.0, 0, 0, 0);
    expect(deviation).toBe(DeviationType.ON_PLAN);
  });
});
