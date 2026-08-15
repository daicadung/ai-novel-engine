import { db } from '@ane/database';
import {
  QualitySnapshot,
  QualityIssue,
  QualityTrend,
  RepairPlan,
  RepairAttemptRecord,
  RepairOutcome,
  QualityHealthStatus,
} from '@ane/core';

/**
 * QualityMemoryService
 *
 * Persists quality results to DB. All records are immutable and append-only.
 * Never overwrites historical quality results.
 * Idempotent writes via correlationId uniqueness.
 */
export class QualityMemoryService {
  // ====================================================================
  // Save quality snapshot (idempotent)
  // ====================================================================
  static async saveSnapshot(snapshot: QualitySnapshot): Promise<string> {
    // Idempotent — correlationId is unique
    const existing = await db.qualitySnapshotRecord.findUnique({
      where: { correlationId: snapshot.correlationId },
    });

    if (existing) return existing.id;

    const record = await db.qualitySnapshotRecord.create({
      data: {
        novelId: snapshot.novelId,
        chapterId: snapshot.chapterId ?? null,
        chapterNumber: snapshot.chapterNumber ?? null,
        correlationId: snapshot.correlationId,
        score: snapshot.score as any,
        healthStatus: snapshot.healthStatus,
        issueCount: snapshot.issues.length,
        overallScore: snapshot.score.overall,
      },
    });

    // Save issues
    if (snapshot.issues.length > 0) {
      await db.qualityIssueRecord.createMany({
        data: snapshot.issues.map((issue) => ({
          novelId: snapshot.novelId,
          snapshotId: record.id,
          chapterId: issue.chapterId ?? null,
          chapterNumber: issue.chapterNumber ?? null,
          sceneId: issue.sceneId ?? null,
          issueType: issue.issueType,
          severity: issue.severity,
          confidence: issue.confidence,
          evidence: issue.evidence,
          affectedEntities: issue.affectedEntities,
          repairStrategy: issue.suggestedRepairStrategy,
          isAutoRepairable: issue.isAutomaticallyRepairable,
          requiresLLM: issue.requiresLLM,
          detectedBy: issue.detectedBy,
        })),
      });
    }

    return record.id;
  }

  // ====================================================================
  // Save quality trend record
  // ====================================================================
  static async saveTrend(trend: QualityTrend): Promise<string> {
    const record = await db.qualityTrendRecord.create({
      data: {
        novelId: trend.novelId,
        windowStart: trend.windowStart,
        windowEnd: trend.windowEnd,
        direction: trend.direction,
        healthStatus: trend.healthStatus,
        averageScore: trend.averageScore,
        minScore: trend.minScore,
        maxScore: trend.maxScore,
        consecutiveDrops: trend.consecutiveDrops,
        recoveryDetected: trend.recoveryDetected,
        scores: trend.scores as any,
      },
    });

    return record.id;
  }

  // ====================================================================
  // Save repair plan
  // ====================================================================
  static async saveRepairPlan(plan: RepairPlan): Promise<string> {
    const record = await db.repairPlanRecord.create({
      data: {
        id: plan.id,
        novelId: plan.novelId,
        chapterId: plan.chapterId,
        chapterNumber: plan.chapterNumber,
        decision: plan.decision,
        primaryStrategy: plan.primaryStrategy,
        targetDimensions: plan.targetDimensions,
        estimatedTokens: plan.estimatedTokens,
        estimatedCostUsd: plan.estimatedCostUsd,
        budgetApproved: plan.budgetApproved,
        reason: plan.reason,
        issueIds: plan.issues.map((i) => i.id),
      },
    });

    return record.id;
  }

  // ====================================================================
  // Record repair attempt outcome (immutable append)
  // ====================================================================
  static async recordRepairAttempt(attempt: RepairAttemptRecord): Promise<string> {
    const record = await db.repairAttemptRecord.create({
      data: {
        id: attempt.id,
        novelId: attempt.novelId,
        chapterId: attempt.chapterId,
        chapterProseVersionId: attempt.chapterProseVersionId,
        repairPlanId: attempt.repairPlanId,
        strategy: attempt.strategy,
        attemptNumber: attempt.attemptNumber,
        outcome: attempt.outcome,
        originalScore: attempt.originalScore,
        candidateScore: attempt.candidateScore ?? null,
        improvement: attempt.improvement ?? null,
        candidateFingerprint: attempt.candidateFingerprint ?? null,
      },
    });

    return record.id;
  }

  // ====================================================================
  // Mark quality issue resolved
  // ====================================================================
  static async markIssueResolved(
    novelId: string,
    chapterId: string,
    issueType: string
  ): Promise<void> {
    await db.qualityIssueRecord.updateMany({
      where: {
        novelId,
        chapterId,
        issueType,
        resolved: false,
      },
      data: {
        resolved: true,
        resolvedAt: new Date(),
      },
    });
  }

  // ====================================================================
  // Get recent score history for trend analysis
  // ====================================================================
  static async getScoreHistory(
    novelId: string,
    windowChapters: number
  ): Promise<Array<{ chapterNumber: number; overall: number }>> {
    const records = await db.qualitySnapshotRecord.findMany({
      where: { novelId, chapterNumber: { not: null } },
      orderBy: { chapterNumber: 'asc' },
      take: windowChapters * 2,
      select: { chapterNumber: true, overallScore: true },
    });

    return records
      .filter((r) => r.chapterNumber !== null)
      .map((r) => ({
        chapterNumber: r.chapterNumber!,
        overall: r.overallScore,
      }));
  }

  // ====================================================================
  // Get unresolved issues for a chapter
  // ====================================================================
  static async getUnresolvedIssues(
    novelId: string,
    chapterId: string
  ): Promise<Array<{ issueType: string; severity: string; repairStrategy: string }>> {
    return db.qualityIssueRecord.findMany({
      where: { novelId, chapterId, resolved: false },
      select: { issueType: true, severity: true, repairStrategy: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ====================================================================
  // Count repair attempts for a chapter (loop protection)
  // ====================================================================
  static async countRepairAttempts(
    novelId: string,
    chapterId: string,
    chapterProseVersionId?: string
  ): Promise<number> {
    return db.repairAttemptRecord.count({
      where: {
        novelId,
        chapterId,
        ...(chapterProseVersionId ? { chapterProseVersionId } : {}),
      },
    });
  }

  // ====================================================================
  // Detect oscillation: same candidate fingerprint returned multiple times
  // ====================================================================
  static async detectOscillation(
    novelId: string,
    chapterId: string,
    fingerprint: string
  ): Promise<boolean> {
    const count = await db.repairAttemptRecord.count({
      where: {
        novelId,
        chapterId,
        candidateFingerprint: fingerprint,
        outcome: { in: ['REJECTED', 'IDENTICAL_CANDIDATE'] },
      },
    });
    return count >= 2;
  }

  // ====================================================================
  // Get latest snapshot for a chapter
  // ====================================================================
  static async getLatestSnapshot(
    novelId: string,
    chapterId: string
  ): Promise<{ overallScore: number; healthStatus: string; issueCount: number } | null> {
    const record = await db.qualitySnapshotRecord.findFirst({
      where: { novelId, chapterId },
      orderBy: { createdAt: 'desc' },
      select: { overallScore: true, healthStatus: true, issueCount: true },
    });
    return record;
  }

  // ====================================================================
  // Get latest trend for a novel
  // ====================================================================
  static async getLatestTrend(
    novelId: string
  ): Promise<{ direction: string; healthStatus: string; averageScore: number } | null> {
    return db.qualityTrendRecord.findFirst({
      where: { novelId },
      orderBy: { createdAt: 'desc' },
      select: { direction: true, healthStatus: true, averageScore: true },
    });
  }

  // ====================================================================
  // Save content fingerprints for repetition detection
  // ====================================================================
  static async saveFingerprints(
    novelId: string,
    chapterId: string,
    chapterNumber: number,
    fingerprints: Array<{
      fingerprint: string;
      category: string;
      contentPreview: string;
      sceneId?: string;
    }>
  ): Promise<void> {
    for (const fp of fingerprints) {
      await db.contentFingerprintRecord.upsert({
        where: { novelId_chapterId_category: { novelId, chapterId, category: fp.category } },
        create: {
          novelId,
          chapterId,
          chapterNumber,
          fingerprint: fp.fingerprint,
          category: fp.category,
          contentPreview: fp.contentPreview,
          sceneId: fp.sceneId ?? null,
        },
        update: {
          fingerprint: fp.fingerprint,
          contentPreview: fp.contentPreview,
        },
      });
    }
  }

  // ====================================================================
  // Get fingerprints for repetition detection (bounded window)
  // ====================================================================
  static async getRecentFingerprints(
    novelId: string,
    beforeChapter: number,
    windowChapters: number,
    categories: string[]
  ): Promise<Array<{
    chapterId: string;
    chapterNumber: number;
    fingerprint: string;
    category: string;
    contentPreview: string;
  }>> {
    return db.contentFingerprintRecord.findMany({
      where: {
        novelId,
        chapterNumber: {
          gte: beforeChapter - windowChapters,
          lt: beforeChapter,
        },
        category: { in: categories },
      },
      orderBy: { chapterNumber: 'desc' },
    });
  }
}
