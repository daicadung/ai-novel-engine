import {
  StoryArcPlan,
  NarrativeMilestone,
  NarrativeObligation,
  ForeshadowingPlanRecord,
  ChapterObjective,
  CharacterArcPlanDetail,
  MilestoneStatus,
  ObligationStatus,
  ArcStatus,
  DeviationType,
} from '@ane/core';

export interface PlanValidationError {
  code: string;
  severity: 'ERROR' | 'WARN';
  description: string;
  entityId?: string;
  entityType?: string;
}

export interface PlanValidationResult {
  valid: boolean;
  errors: PlanValidationError[];
  warnings: PlanValidationError[];
}

/**
 * PlanningValidator
 *
 * Deterministic, pure validation — no LLM, no DB.
 * Validates planning state consistency, ordering, dependencies, conflicts.
 */
export class PlanningValidator {
  // ====================================================================
  // Arc validation
  // ====================================================================

  static validateArcs(arcs: StoryArcPlan[]): PlanValidationResult {
    const errors: PlanValidationError[] = [];
    const warnings: PlanValidationError[] = [];

    const sorted = [...arcs].sort((a, b) => a.arcNumber - b.arcNumber);

    let previousEnd = 0;

    for (const arc of sorted) {
      // Arc number must be positive
      if (arc.arcNumber < 1) {
        errors.push({
          code: 'ARC_INVALID_NUMBER',
          severity: 'ERROR',
          description: `Arc ${arc.id} has invalid arcNumber ${arc.arcNumber}`,
          entityId: arc.id,
          entityType: 'StoryArcPlan',
        });
      }

      // Start must be before end
      if (arc.plannedChapterStart >= arc.plannedChapterEnd) {
        errors.push({
          code: 'ARC_INVALID_RANGE',
          severity: 'ERROR',
          description: `Arc "${arc.title}" start (${arc.plannedChapterStart}) >= end (${arc.plannedChapterEnd})`,
          entityId: arc.id,
          entityType: 'StoryArcPlan',
        });
      }

      // No overlap with previous arc
      if (arc.plannedChapterStart < previousEnd) {
        errors.push({
          code: 'ARC_CHAPTER_OVERLAP',
          severity: 'ERROR',
          description: `Arc "${arc.title}" (start=${arc.plannedChapterStart}) overlaps with previous arc (end=${previousEnd})`,
          entityId: arc.id,
          entityType: 'StoryArcPlan',
        });
      }

      // Must have objective
      if (!arc.objective || arc.objective.trim().length < 10) {
        warnings.push({
          code: 'ARC_MISSING_OBJECTIVE',
          severity: 'WARN',
          description: `Arc "${arc.title}" has an incomplete objective`,
          entityId: arc.id,
          entityType: 'StoryArcPlan',
        });
      }

      // Exit conditions required for completion tracking
      if (!arc.exitConditions || arc.exitConditions.length === 0) {
        warnings.push({
          code: 'ARC_MISSING_EXIT_CONDITIONS',
          severity: 'WARN',
          description: `Arc "${arc.title}" has no exit conditions — arc completion cannot be evaluated`,
          entityId: arc.id,
          entityType: 'StoryArcPlan',
        });
      }

      previousEnd = arc.plannedChapterEnd;
    }

    // Only one ACTIVE arc at a time
    const activeArcs = arcs.filter((a) => a.status === ArcStatus.ACTIVE);
    if (activeArcs.length > 1) {
      errors.push({
        code: 'MULTIPLE_ACTIVE_ARCS',
        severity: 'ERROR',
        description: `${activeArcs.length} arcs are simultaneously ACTIVE — only one may be active`,
        entityType: 'StoryArcPlan',
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // ====================================================================
  // Milestone validation
  // ====================================================================

  static validateMilestones(
    milestones: NarrativeMilestone[],
    arcs: StoryArcPlan[]
  ): PlanValidationResult {
    const errors: PlanValidationError[] = [];
    const warnings: PlanValidationError[] = [];
    const milestoneIds = new Set(milestones.map((m) => m.id));

    for (const ms of milestones) {
      // Window validity
      if (ms.plannedChapterMin > ms.plannedChapterMax) {
        errors.push({
          code: 'MILESTONE_INVALID_WINDOW',
          severity: 'ERROR',
          description: `Milestone "${ms.title}" has min=${ms.plannedChapterMin} > max=${ms.plannedChapterMax}`,
          entityId: ms.id,
          entityType: 'NarrativeMilestone',
        });
      }

      // Prerequisites must reference known milestones
      for (const prereqId of ms.prerequisites) {
        if (!milestoneIds.has(prereqId)) {
          errors.push({
            code: 'MILESTONE_UNKNOWN_PREREQ',
            severity: 'ERROR',
            description: `Milestone "${ms.title}" references unknown prerequisite ${prereqId}`,
            entityId: ms.id,
            entityType: 'NarrativeMilestone',
          });
        }
      }

      // Self-referential prerequisite
      if (ms.prerequisites.includes(ms.id)) {
        errors.push({
          code: 'MILESTONE_SELF_PREREQ',
          severity: 'ERROR',
          description: `Milestone "${ms.title}" references itself as a prerequisite`,
          entityId: ms.id,
          entityType: 'NarrativeMilestone',
        });
      }

      // Circular dependency detection
      if (this.hasCircularDependency(ms.id, milestones)) {
        errors.push({
          code: 'MILESTONE_CIRCULAR_DEPENDENCY',
          severity: 'ERROR',
          description: `Milestone "${ms.title}" is part of a circular dependency chain`,
          entityId: ms.id,
          entityType: 'NarrativeMilestone',
        });
      }

      // Must have involved entities
      if (ms.involvedEntityIds.length === 0 && !ms.isOptional) {
        warnings.push({
          code: 'MILESTONE_NO_ENTITIES',
          severity: 'WARN',
          description: `Required milestone "${ms.title}" references no entities`,
          entityId: ms.id,
          entityType: 'NarrativeMilestone',
        });
      }
    }

    // Duplicate milestones
    const titles = milestones.map((m) => m.title.toLowerCase().trim());
    const seen = new Set<string>();
    for (const title of titles) {
      if (seen.has(title)) {
        warnings.push({
          code: 'MILESTONE_DUPLICATE_TITLE',
          severity: 'WARN',
          description: `Duplicate milestone title detected: "${title}"`,
          entityType: 'NarrativeMilestone',
        });
      }
      seen.add(title);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // ====================================================================
  // Obligation validation
  // ====================================================================

  static validateObligations(obligations: NarrativeObligation[]): PlanValidationResult {
    const errors: PlanValidationError[] = [];
    const warnings: PlanValidationError[] = [];
    const obligationIds = new Set(obligations.map((o) => o.id));

    for (const ob of obligations) {
      // Orphaned obligations: satisfied/failed but still referenced as deps
      if (
        ob.status === ObligationStatus.INVALIDATED ||
        ob.status === ObligationStatus.FAILED
      ) {
        // Other obligations that depend on this — those are orphaned
        const orphans = obligations.filter(
          (o) =>
            o.dependentObligationIds.includes(ob.id) &&
            o.status === ObligationStatus.OPEN
        );
        for (const orphan of orphans) {
          warnings.push({
            code: 'OBLIGATION_ORPHANED_DEPENDENCY',
            severity: 'WARN',
            description: `Obligation "${orphan.description}" depends on ${ob.status.toLowerCase()} obligation "${ob.description}"`,
            entityId: orphan.id,
            entityType: 'NarrativeObligation',
          });
        }
      }

      // Target resolution must be after establishment
      if (
        ob.targetResolutionChapter &&
        ob.targetResolutionChapter <= ob.establishedChapter
      ) {
        errors.push({
          code: 'OBLIGATION_IMPOSSIBLE_TIMING',
          severity: 'ERROR',
          description: `Obligation "${ob.description}" resolution chapter (${ob.targetResolutionChapter}) <= establishment chapter (${ob.establishedChapter})`,
          entityId: ob.id,
          entityType: 'NarrativeObligation',
        });
      }

      // Unknown dependency references
      for (const depId of ob.dependentObligationIds) {
        if (!obligationIds.has(depId)) {
          warnings.push({
            code: 'OBLIGATION_UNKNOWN_DEPENDENCY',
            severity: 'WARN',
            description: `Obligation "${ob.description}" references unknown dependency ${depId}`,
            entityId: ob.id,
            entityType: 'NarrativeObligation',
          });
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // ====================================================================
  // Foreshadowing validation
  // ====================================================================

  static validateForeshadowing(
    plans: ForeshadowingPlanRecord[],
    currentChapter: number
  ): PlanValidationResult {
    const errors: PlanValidationError[] = [];
    const warnings: PlanValidationError[] = [];

    for (const fp of plans) {
      // Reveal window must be before payoff window
      if (fp.revealWindowStart > fp.payoffWindowStart) {
        errors.push({
          code: 'FORESHADOWING_REVEAL_AFTER_PAYOFF',
          severity: 'ERROR',
          description: `Foreshadowing "${fp.description}" reveal window starts after payoff window`,
          entityId: fp.id,
          entityType: 'ForeshadowingPlanRecord',
        });
      }

      // Payoff too early (before minimum setups)
      if (
        fp.actualSetupCount < fp.minimumOccurrences &&
        fp.payoffWindowStart <= currentChapter
      ) {
        warnings.push({
          code: 'FORESHADOWING_INSUFFICIENT_SETUP',
          severity: 'WARN',
          description: `Foreshadowing "${fp.description}" payoff window has started but only ${fp.actualSetupCount}/${fp.minimumOccurrences} setups delivered`,
          entityId: fp.id,
          entityType: 'ForeshadowingPlanRecord',
        });
      }

      // Forgotten setup: payoff window passed
      if (
        fp.actualSetupCount > 0 &&
        fp.payoffWindowEnd < currentChapter &&
        fp.status !== 'PAID_OFF' &&
        fp.status !== 'CANCELLED'
      ) {
        errors.push({
          code: 'FORESHADOWING_FORGOTTEN',
          severity: 'ERROR',
          description: `Foreshadowing "${fp.description}" has ${fp.actualSetupCount} setups but payoff window ended at chapter ${fp.payoffWindowEnd}`,
          entityId: fp.id,
          entityType: 'ForeshadowingPlanRecord',
        });
      }

      // Window validity
      if (fp.revealWindowStart > fp.revealWindowEnd) {
        errors.push({
          code: 'FORESHADOWING_INVALID_REVEAL_WINDOW',
          severity: 'ERROR',
          description: `Foreshadowing "${fp.description}" has invalid reveal window (${fp.revealWindowStart} > ${fp.revealWindowEnd})`,
          entityId: fp.id,
          entityType: 'ForeshadowingPlanRecord',
        });
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // ====================================================================
  // Chapter Objective validation
  // ====================================================================

  static validateChapterObjective(
    obj: ChapterObjective,
    arc: StoryArcPlan | undefined
  ): PlanValidationResult {
    const errors: PlanValidationError[] = [];
    const warnings: PlanValidationError[] = [];

    // Primary objective must exist
    if (!obj.primaryObjective || obj.primaryObjective.trim().length < 5) {
      errors.push({
        code: 'OBJECTIVE_MISSING_PRIMARY',
        severity: 'ERROR',
        description: `Chapter ${obj.chapterNumber} has no primary objective`,
        entityId: obj.id,
        entityType: 'ChapterObjective',
      });
    }

    // No contradictions between required and forbidden events
    const reqSet = new Set(obj.requiredEvents.map((e) => e.toLowerCase().trim()));
    for (const forbidden of obj.forbiddenEvents) {
      if (reqSet.has(forbidden.toLowerCase().trim())) {
        errors.push({
          code: 'OBJECTIVE_CONTRADICTORY_EVENTS',
          severity: 'ERROR',
          description: `Chapter ${obj.chapterNumber}: event "${forbidden}" is both required AND forbidden`,
          entityId: obj.id,
          entityType: 'ChapterObjective',
        });
      }
    }

    // Chapter must be within its arc range
    if (arc) {
      const effectiveEnd = arc.plannedChapterEnd + arc.maxExtensionChapters;
      if (
        obj.chapterNumber < arc.plannedChapterStart ||
        obj.chapterNumber > effectiveEnd
      ) {
        warnings.push({
          code: 'OBJECTIVE_OUTSIDE_ARC_RANGE',
          severity: 'WARN',
          description: `Chapter ${obj.chapterNumber} objective falls outside arc "${arc.title}" range (${arc.plannedChapterStart}–${effectiveEnd})`,
          entityId: obj.id,
          entityType: 'ChapterObjective',
        });
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // ====================================================================
  // Deviation classification — pure math
  // ====================================================================

  static classifyDeviation(
    objectiveCompletionScore: number,
    missedRequiredCount: number,
    forbiddenTriggeredCount: number,
    totalRequiredCount: number
  ): DeviationType {
    if (forbiddenTriggeredCount > 0) {
      return DeviationType.MAJOR_DEVIATION;
    }
    if (objectiveCompletionScore >= 0.9) {
      return DeviationType.ON_PLAN;
    }
    if (objectiveCompletionScore >= 0.7) {
      return DeviationType.MINOR_DEVIATION;
    }
    const missedFraction =
      totalRequiredCount > 0 ? missedRequiredCount / totalRequiredCount : 0;

    if (missedFraction > 0.5 || objectiveCompletionScore < 0.4) {
      return DeviationType.MAJOR_DEVIATION;
    }
    return DeviationType.ADAPTABLE_DEVIATION;
  }

  // ====================================================================
  // Circular dependency check (DFS)
  // ====================================================================

  static hasCircularDependency(
    startId: string,
    milestones: NarrativeMilestone[]
  ): boolean {
    const milestoneMap = new Map(milestones.map((m) => [m.id, m]));
    const visited = new Set<string>();

    const dfs = (id: string, path: Set<string>): boolean => {
      if (path.has(id)) return true;
      if (visited.has(id)) return false;

      visited.add(id);
      path.add(id);

      const ms = milestoneMap.get(id);
      if (ms) {
        for (const prereqId of ms.prerequisites) {
          if (dfs(prereqId, new Set(path))) return true;
        }
      }

      path.delete(id);
      return false;
    };

    return dfs(startId, new Set());
  }
}
