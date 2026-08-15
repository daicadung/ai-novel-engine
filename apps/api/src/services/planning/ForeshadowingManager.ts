import { db } from '@ane/database';
import {
  ForeshadowingPlanRecord,
  ForeshadowingStatus,
  ForeshadowingStrength,
  ObligationStatus,
  ObligationType,
  NarrativeObligation,
} from '@ane/core';

/**
 * ForeshadowingManager
 *
 * Tracks all foreshadowing plans across the novel.
 * Detects: forgotten setups, insufficient setups, early payoffs, overused foreshadowing.
 * No LLM. No direct canonical mutation.
 */
export class ForeshadowingManager {
  /**
   * Register a new foreshadowing plan.
   * Idempotent — if a plan with same target/type exists in same window, skip.
   */
  async register(
    novelId: string,
    plan: {
      targetMilestoneId?: string;
      targetObligationId?: string;
      setupType: string;
      description: string;
      strength: ForeshadowingStrength;
      revealWindowStart: number;
      revealWindowEnd: number;
      payoffWindowStart: number;
      payoffWindowEnd: number;
      minimumOccurrences: number;
      plannedSetupChapters: number[];
    }
  ): Promise<ForeshadowingPlanRecord> {
    // Idempotency: check for exact target + setup type + window
    const existing = await db.foreshadowingPlanRecord.findFirst({
      where: {
        novelId,
        targetMilestoneId: plan.targetMilestoneId ?? null,
        targetObligationId: plan.targetObligationId ?? null,
        setupType: plan.setupType,
        revealWindowStart: plan.revealWindowStart,
        payoffWindowEnd: plan.payoffWindowEnd,
        status: { notIn: ['CANCELLED'] },
      },
    });

    if (existing) {
      return this.mapRecord(existing);
    }

    const record = await db.foreshadowingPlanRecord.create({
      data: {
        novelId,
        targetMilestoneId: plan.targetMilestoneId ?? null,
        targetObligationId: plan.targetObligationId ?? null,
        setupType: plan.setupType,
        description: plan.description,
        strength: plan.strength,
        plannedSetupChapters: plan.plannedSetupChapters,
        minimumOccurrences: plan.minimumOccurrences,
        actualSetupCount: 0,
        revealWindowStart: plan.revealWindowStart,
        revealWindowEnd: plan.revealWindowEnd,
        payoffWindowStart: plan.payoffWindowStart,
        payoffWindowEnd: plan.payoffWindowEnd,
        status: ForeshadowingStatus.PLANNED,
      },
    });

    return this.mapRecord(record);
  }

  /**
   * Record a setup delivery for this chapter.
   */
  async recordSetup(novelId: string, planId: string, chapterNumber: number): Promise<void> {
    const record = await db.foreshadowingPlanRecord.findUnique({ where: { id: planId } });
    if (!record || record.novelId !== novelId) return;
    if (record.status === ForeshadowingStatus.CANCELLED || record.status === ForeshadowingStatus.PAID_OFF) return;

    await db.foreshadowingPlanRecord.update({
      where: { id: planId },
      data: {
        actualSetupCount: { increment: 1 },
        status: ForeshadowingStatus.ACTIVE,
      },
    });
  }

  /**
   * Record payoff delivered for this chapter.
   */
  async recordPayoff(novelId: string, planId: string, chapterNumber: number): Promise<void> {
    const record = await db.foreshadowingPlanRecord.findUnique({ where: { id: planId } });
    if (!record || record.novelId !== novelId) return;

    await db.foreshadowingPlanRecord.update({
      where: { id: planId },
      data: { status: ForeshadowingStatus.PAID_OFF },
    });
  }

  /**
   * Mark forgotten setups (payoff window passed, never paid off).
   * Call this during reconciliation.
   */
  async detectForgotten(novelId: string, currentChapter: number): Promise<string[]> {
    const forgotten = await db.foreshadowingPlanRecord.findMany({
      where: {
        novelId,
        actualSetupCount: { gt: 0 },
        payoffWindowEnd: { lt: currentChapter },
        status: { in: [ForeshadowingStatus.PLANNED, ForeshadowingStatus.ACTIVE] },
      },
    });

    const ids: string[] = [];
    for (const f of forgotten) {
      await db.foreshadowingPlanRecord.update({
        where: { id: f.id },
        data: { status: ForeshadowingStatus.FORGOTTEN },
      });
      ids.push(f.id);
    }
    return ids;
  }

  /**
   * Get pending foreshadowing for current chapter window.
   */
  async getPendingForChapter(
    novelId: string,
    chapterNumber: number
  ): Promise<ForeshadowingPlanRecord[]> {
    const records = await db.foreshadowingPlanRecord.findMany({
      where: {
        novelId,
        status: { in: [ForeshadowingStatus.PLANNED, ForeshadowingStatus.ACTIVE] },
        OR: [
          // Setup opportunity this chapter
          {
            revealWindowStart: { lte: chapterNumber },
            revealWindowEnd: { gte: chapterNumber },
            actualSetupCount: 0,
          },
          // Payoff due soon
          {
            payoffWindowStart: { lte: chapterNumber + 5 },
            status: ForeshadowingStatus.ACTIVE,
          },
        ],
      },
      take: 15,
    });
    return records.map(this.mapRecord);
  }

  /**
   * Detect health issues: reveal-without-setup, excessive setup, etc.
   */
  static detectHealthIssues(
    plans: ForeshadowingPlanRecord[],
    currentChapter: number
  ): Array<{ planId: string; issue: string; severity: 'WARN' | 'ERROR' }> {
    const issues: Array<{ planId: string; issue: string; severity: 'WARN' | 'ERROR' }> = [];

    for (const fp of plans) {
      // Payoff window started but no setup yet
      if (
        fp.payoffWindowStart <= currentChapter &&
        fp.actualSetupCount === 0 &&
        fp.status !== ForeshadowingStatus.CANCELLED
      ) {
        issues.push({
          planId: fp.id,
          issue: `REVEAL_WITHOUT_SETUP: "${fp.description}" — payoff window open but 0 setups delivered`,
          severity: 'ERROR',
        });
      }

      // Excessive setup (more than 3x minimum)
      if (fp.actualSetupCount > fp.minimumOccurrences * 3) {
        issues.push({
          planId: fp.id,
          issue: `EXCESSIVE_SETUP: "${fp.description}" — ${fp.actualSetupCount} setups for min ${fp.minimumOccurrences}`,
          severity: 'WARN',
        });
      }

      // Forgotten
      if (fp.status === ForeshadowingStatus.FORGOTTEN) {
        issues.push({
          planId: fp.id,
          issue: `FORGOTTEN_SETUP: "${fp.description}" — setup delivered but payoff window missed`,
          severity: 'ERROR',
        });
      }
    }

    return issues;
  }

  private mapRecord(r: any): ForeshadowingPlanRecord {
    return {
      id: r.id,
      novelId: r.novelId,
      targetMilestoneId: r.targetMilestoneId ?? undefined,
      targetObligationId: r.targetObligationId ?? undefined,
      setupType: r.setupType,
      plannedSetupChapters: (r.plannedSetupChapters as number[]) ?? [],
      minimumOccurrences: r.minimumOccurrences,
      actualSetupCount: r.actualSetupCount,
      revealWindowStart: r.revealWindowStart,
      revealWindowEnd: r.revealWindowEnd,
      payoffWindowStart: r.payoffWindowStart,
      payoffWindowEnd: r.payoffWindowEnd,
      strength: r.strength as ForeshadowingStrength,
      status: r.status as ForeshadowingStatus,
      description: r.description,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}

// ====================================================================
// NarrativeObligationTracker
// ====================================================================

/**
 * NarrativeObligationTracker
 *
 * Creates, tracks progression, and satisfies narrative obligations.
 * Identifies when obligations are created, progressed, satisfied, invalidated, or forgotten.
 */
export class NarrativeObligationTracker {
  /**
   * Create a new narrative obligation.
   * Idempotent — description + establishedChapter uniqueness.
   */
  async create(
    novelId: string,
    obligation: {
      obligationType: ObligationType;
      description: string;
      establishedChapter: number;
      establishedBy: string;
      targetResolutionChapter?: number;
      involvedEntityIds?: string[];
      priority?: number;
    }
  ): Promise<NarrativeObligation> {
    // Idempotency check
    const existing = await db.narrativeObligationRecord.findFirst({
      where: {
        novelId,
        description: obligation.description,
        establishedChapter: obligation.establishedChapter,
        status: { notIn: [ObligationStatus.INVALIDATED, ObligationStatus.FAILED] },
      },
    });

    if (existing) {
      return this.mapObligation(existing);
    }

    const record = await db.narrativeObligationRecord.create({
      data: {
        novelId,
        obligationType: obligation.obligationType,
        description: obligation.description,
        establishedChapter: obligation.establishedChapter,
        establishedBy: obligation.establishedBy,
        targetResolutionChapter: obligation.targetResolutionChapter ?? null,
        status: ObligationStatus.OPEN,
        progressNotes: [],
        involvedEntityIds: obligation.involvedEntityIds ?? [],
        dependentObligationIds: [],
        priority: obligation.priority ?? 5,
      },
    });

    return this.mapObligation(record);
  }

  /**
   * Progress an obligation with a note.
   */
  async progress(novelId: string, obligationId: string, note: string): Promise<void> {
    const record = await db.narrativeObligationRecord.findUnique({
      where: { id: obligationId },
    });
    if (!record || record.novelId !== novelId) return;
    if (
      record.status === ObligationStatus.SATISFIED ||
      record.status === ObligationStatus.INVALIDATED
    ) return;

    const notes = (record.progressNotes as string[]) ?? [];
    notes.push(note);

    await db.narrativeObligationRecord.update({
      where: { id: obligationId },
      data: {
        status: ObligationStatus.PROGRESSING,
        progressNotes: notes,
      },
    });
  }

  /**
   * Mark obligation as satisfied.
   */
  async satisfy(novelId: string, obligationId: string, resolutionChapter: number): Promise<void> {
    const record = await db.narrativeObligationRecord.findUnique({
      where: { id: obligationId },
    });
    if (!record || record.novelId !== novelId) return;

    await db.narrativeObligationRecord.update({
      where: { id: obligationId },
      data: {
        status: ObligationStatus.SATISFIED,
        latestResolutionChapter: resolutionChapter,
      },
    });
  }

  /**
   * Invalidate obligation (canonical events made it impossible).
   */
  async invalidate(novelId: string, obligationId: string, reason: string): Promise<void> {
    const record = await db.narrativeObligationRecord.findUnique({
      where: { id: obligationId },
    });
    if (!record || record.novelId !== novelId) return;

    const notes = (record.progressNotes as string[]) ?? [];
    notes.push(`INVALIDATED: ${reason}`);

    await db.narrativeObligationRecord.update({
      where: { id: obligationId },
      data: {
        status: ObligationStatus.INVALIDATED,
        progressNotes: notes,
      },
    });
  }

  /**
   * Get all open obligations, ordered by priority.
   */
  async getOpen(novelId: string, limit = 20): Promise<NarrativeObligation[]> {
    const records = await db.narrativeObligationRecord.findMany({
      where: {
        novelId,
        status: { in: [ObligationStatus.OPEN, ObligationStatus.PROGRESSING] },
      },
      orderBy: [{ priority: 'desc' }, { establishedChapter: 'asc' }],
      take: limit,
    });
    return records.map(this.mapObligation);
  }

  private mapObligation(r: any): NarrativeObligation {
    return {
      id: r.id,
      novelId: r.novelId,
      obligationType: r.obligationType as ObligationType,
      description: r.description,
      establishedChapter: r.establishedChapter,
      establishedBy: r.establishedBy,
      targetResolutionChapter: r.targetResolutionChapter ?? undefined,
      latestResolutionChapter: r.latestResolutionChapter ?? undefined,
      status: r.status as ObligationStatus,
      progressNotes: (r.progressNotes as string[]) ?? [],
      involvedEntityIds: (r.involvedEntityIds as string[]) ?? [],
      dependentObligationIds: (r.dependentObligationIds as string[]) ?? [],
      priority: r.priority,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
