import { db } from '@ane/database';
import {
  QualityIssue,
  QualitySnapshot,
  QualityTrend,
  ChapterMemory,
  PlotThreadState,
  StateDelta,
  EntityTypeEnum,
  JobType,
  QualityRepairJobPayload,
  QualityHealthStatus,
} from '@ane/core';
import { QualityScoringEngine } from './QualityScoringEngine.js';
import { RepetitionDetector } from './RepetitionDetector.js';
import { PacingAnalyzer, CharacterProgressAnalyzer, PlotProgressAnalyzer } from './Analyzers.js';
import { QualityMemoryService } from './QualityMemoryService.js';
import { RepairPlanner } from './RepairPlanner.js';
import { ObservabilityManager } from '../generation/ObservabilityManager.js';
import { DatabaseQueueManager } from '../queue/DatabaseQueueManager.js';

const REPAIR_ENABLED = process.env.QUALITY_REPAIR_ENABLED !== 'false';
const REPAIR_WINDOW = parseInt(process.env.QUALITY_REPETITION_WINDOW ?? '20', 10);

/**
 * QualityOrchestrator
 *
 * Phase 10 main quality workflow.
 *
 * Lifecycle (called from ProseManager after canonical promotion):
 *   1. Extract context from DB
 *   2. Run all analyzers (deterministic, pure)
 *   3. Compute QualityScore
 *   4. Detect quality trends
 *   5. Build QualitySnapshot (persist to DB)
 *   6. Decide repair need
 *   7. If repair needed: create RepairPlan + enqueue QUALITY_REPAIR job
 *
 * NEVER modifies canonical state directly.
 * NEVER calls LLMs.
 * Uses existing DatabaseQueueManager only.
 */
export class QualityOrchestrator {
  private queue = new DatabaseQueueManager();
  private obs = ObservabilityManager.getInstance();

  async analyze(
    novelId: string,
    chapterId: string,
    chapterNumber: number,
    options: {
      chapterProseVersionId?: string;
      stateDeltas?: StateDelta[];
      wordCount?: number;
      sceneCount?: number;
      continuityConflictCount?: number;
      jobId?: string;
    } = {}
  ): Promise<QualitySnapshot> {
    const {
      chapterProseVersionId,
      stateDeltas = [],
      wordCount = 0,
      sceneCount = 0,
      continuityConflictCount = 0,
    } = options;

    this.obs.recordPhase9Event({
      type: 'NOVEL_GENERATION_STARTED',
      novelId,
      chapterId,
      timestamp: new Date(),
      metadata: { phase: 'quality_analysis', chapterNumber },
    });

    // ---- 1. Load context (bounded) ----
    const chapterMemoryRecord = await db.chapterMemoryRecord.findFirst({
      where: { chapterId },
      orderBy: { createdAt: 'desc' },
    });

    const previousMemoryRecords = await db.chapterMemoryRecord.findMany({
      where: {
        novelId,
        chapterNumber: { gte: chapterNumber - REPAIR_WINDOW, lt: chapterNumber },
      },
      orderBy: { chapterNumber: 'asc' },
    });

    const activeThreadRecords = await db.plotThread.findMany({
      where: { novelId, status: 'ACTIVE' },
      orderBy: [{ importance: 'desc' }],
      take: 20,
    });

    const novel = await db.novel.findUnique({
      where: { id: novelId },
      select: { targetChapters: true },
    });

    const currentMemory = chapterMemoryRecord
      ? (chapterMemoryRecord.summary
          ? {
              chapterId,
              novelId,
              chapterNumber,
              summary: chapterMemoryRecord.summary,
              keyEvents: chapterMemoryRecord.keyEvents as string[] ?? [],
              stateDeltas: [],
              introducedCharacters: [],
              changedRelationships: [],
              revelations: [],
              unresolvedThreads: [],
              resolvedThreads: [],
              locations: chapterMemoryRecord.keyEvents as string[] ?? [],
              importantItems: [],
              emotionalTurningPoints: [],
            }
          : undefined)
      : undefined;

    const previousMemories: ChapterMemory[] = previousMemoryRecords.map((r) => ({
      chapterId: r.chapterId,
      novelId,
      chapterNumber: r.chapterNumber,
      summary: r.summary,
      keyEvents: r.keyEvents as string[] ?? [],
      stateDeltas: [],
      introducedCharacters: [],
      changedRelationships: [],
      revelations: [],
      unresolvedThreads: [],
      resolvedThreads: [],
      locations: [],
      importantItems: [],
      emotionalTurningPoints: [],
    }));

    const activeThreads: PlotThreadState[] = activeThreadRecords.map((t) => ({
      id: t.id,
      title: t.title,
      status: (t.status as any) ?? 'ACTIVE',
      priority: t.importance ?? 5,
      introducedChapter: undefined,
      lastReferencedChapter: undefined,
    }));

    // ---- 2. Run all analyzers ----
    const allIssues: QualityIssue[] = [];

    // Repetition
    if (currentMemory) {
      const repetitionIssues = RepetitionDetector.detectFromMemories(
        novelId,
        chapterId,
        chapterNumber,
        currentMemory,
        previousMemories
      );
      allIssues.push(...repetitionIssues);
    }

    // Pacing
    const pacingIssues = PacingAnalyzer.analyze(novelId, chapterId, chapterNumber, {
      memory: currentMemory,
      wordCount,
      sceneCount,
      stateDeltas,
      activeThreads,
    });
    allIssues.push(...pacingIssues);

    // Character
    const charIssues = CharacterProgressAnalyzer.analyze(novelId, chapterId, chapterNumber, {
      memory: currentMemory,
      previousMemories,
      stateDeltas,
    });
    allIssues.push(...charIssues);

    // Plot
    const plotIssues = PlotProgressAnalyzer.analyze(novelId, chapterId, chapterNumber, {
      memory: currentMemory,
      previousMemories,
      activeThreads,
      stateDeltas,
      targetChapters: novel?.targetChapters ?? 100,
    });
    allIssues.push(...plotIssues);

    // ---- 3. Compute score ----
    const score = QualityScoringEngine.computeScore(novelId, chapterId, chapterNumber, {
      issues: allIssues,
      memory: currentMemory,
      previousMemories,
      activeThreads,
      proseWordCount: wordCount,
      sceneCount,
      continuityConflictCount,
    });

    // ---- 4. Trend analysis ----
    const scoreHistory = await QualityMemoryService.getScoreHistory(novelId, 30);
    scoreHistory.push({ chapterNumber, overall: score.overall });

    const trend = QualityScoringEngine.computeTrend(novelId, scoreHistory);

    // ---- 5. Build & persist snapshot ----
    const snapshot = QualityScoringEngine.buildSnapshot(
      novelId,
      chapterId,
      chapterNumber,
      score,
      allIssues,
      trend
    );

    // Non-fatal save
    await QualityMemoryService.saveSnapshot(snapshot).catch((err) => {
      console.error('[QualityOrchestrator] Failed to save snapshot:', err);
    });

    await QualityMemoryService.saveTrend(trend).catch(() => {});

    // Emit degradation events
    if (
      trend.healthStatus === QualityHealthStatus.DEGRADING ||
      trend.healthStatus === QualityHealthStatus.CRITICAL
    ) {
      this.obs.recordPhase9Event({
        type: 'QUALITY_GATE_FAILED',
        novelId,
        chapterId,
        timestamp: new Date(),
        metadata: { healthStatus: trend.healthStatus, overallScore: score.overall },
      });
    }

    for (const issue of allIssues) {
      if (issue.severity === 'CRITICAL' || issue.severity === 'HIGH') {
        this.obs.recordPhase9Event({
          type: 'CONTINUITY_CONFLICT',
          novelId,
          chapterId,
          timestamp: new Date(),
          metadata: { issueType: issue.issueType, severity: issue.severity },
        });
      }
    }

    // ---- 6. Repair decision ----
    if (REPAIR_ENABLED && chapterProseVersionId && allIssues.length > 0) {
      await this.planAndEnqueueRepair(
        novelId,
        chapterId,
        chapterNumber,
        chapterProseVersionId,
        allIssues,
        score.overall
      ).catch((err) => {
        console.error('[QualityOrchestrator] Repair planning failed (non-fatal):', err);
      });
    }

    return snapshot;
  }

  // ====================================================================
  // Plan repair and enqueue if approved
  // ====================================================================
  private async planAndEnqueueRepair(
    novelId: string,
    chapterId: string,
    chapterNumber: number,
    chapterProseVersionId: string,
    issues: QualityIssue[],
    currentScore: number
  ): Promise<void> {
    const plan = await RepairPlanner.plan(
      novelId,
      chapterId,
      chapterNumber,
      chapterProseVersionId,
      issues,
      currentScore
    );

    // Save plan (non-fatal)
    await QualityMemoryService.saveRepairPlan(plan).catch(() => {});

    this.obs.recordPhase9Event({
      type: 'NOVEL_GENERATION_STARTED',
      novelId,
      chapterId,
      timestamp: new Date(),
      metadata: { event: 'repair_planned', decision: plan.decision, planId: plan.id },
    });

    if (plan.decision === 'NO_REPAIR' || plan.decision === 'DEFER') return;

    if (!plan.budgetApproved) return;

    // Enqueue via existing DatabaseQueueManager
    const idempotencyKey = `REPAIR:${novelId}:${chapterId}:${chapterProseVersionId}:${plan.id}`;

    const payload: QualityRepairJobPayload = {
      novelId,
      chapterId,
      chapterProseVersionId,
      repairPlanId: plan.id,
      strategy: plan.primaryStrategy,
      issueIds: issues.map((i) => i.id),
      attemptNumber: 1,
    };

    await this.queue.addJob(JobType.QUALITY_REPAIR, payload, {
      jobId: idempotencyKey,
      attempts: 2,
    });

    this.obs.recordPhase9Event({
      type: 'NOVEL_GENERATION_STARTED',
      novelId,
      chapterId,
      timestamp: new Date(),
      metadata: { event: 'repair_queued', planId: plan.id, strategy: plan.primaryStrategy },
    });
  }

  // ====================================================================
  // Save fingerprints for this chapter
  // ====================================================================
  async saveChapterFingerprints(
    novelId: string,
    chapterId: string,
    chapterNumber: number,
    memory: Partial<ChapterMemory>
  ): Promise<void> {
    const fingerprints = RepetitionDetector.buildFingerprint(novelId, chapterId, chapterNumber, {
      summary: memory.summary,
      keyEvents: memory.keyEvents,
      endingHint: memory.emotionalTurningPoints?.[0],
    });

    await QualityMemoryService.saveFingerprints(
      novelId,
      chapterId,
      chapterNumber,
      fingerprints.map((fp) => ({
        fingerprint: fp.fingerprint,
        category: fp.category,
        contentPreview: fp.content,
        sceneId: fp.sceneId,
      }))
    ).catch(() => {});
  }
}
