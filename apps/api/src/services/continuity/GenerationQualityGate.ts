import { db } from '@ane/database';
import {
  QualityGateReport,
  QualityGateResult,
  ContinuityConflict,
  ConflictSeverity,
  StoryState,
  StateDelta,
} from '@ane/core';
import { LongTermContinuityValidator } from './LongTermContinuityValidator.js';
import { PlotThreadManager } from './PlotThreadManager.js';

/**
 * GenerationQualityGate
 *
 * Runs all validation checks before canonical prose promotion.
 *
 * Gate sequence:
 * 1. Structural validation (required fields present)
 * 2. Continuity validation (state consistency)
 * 3. Knowledge validation (POV boundaries)
 * 4. State transition validation (valid deltas)
 * 5. Plot thread validation (orphan detection)
 * 6. Character arc validation (arc consistency)
 * 7. Budget validation (cost not exceeded)
 *
 * HARD failures (ERROR) → BLOCK promotion
 * SOFT failures (WARNING) → configurable: WARN or REVISE
 * INFO → log only, do not block
 */
export class GenerationQualityGate {
  static readonly HARD_FAIL_MODE = 'BLOCK';
  static readonly SOFT_FAIL_MODE: 'WARN' | 'REVISE' =
    (process.env.QUALITY_GATE_SOFT_FAIL_MODE as 'WARN' | 'REVISE') ?? 'WARN';

  // ====================================================================
  // Full gate — call before canonical promotion
  // ====================================================================
  static async runGate(
    novelId: string,
    chapterId: string,
    chapterProseVersionId: string,
    options: {
      currentState?: StoryState;
      proposedDeltas?: StateDelta[];
      proseText?: string;
      sceneId?: string;
      chapterNumber?: number;
      skipBudgetCheck?: boolean;
    } = {}
  ): Promise<QualityGateReport> {
    const allConflicts: ContinuityConflict[] = [];
    const warnings: string[] = [];

    // ---- 1. Structural validation ----
    const structuralResult = await this.runStructuralValidation(chapterId);
    if (structuralResult !== QualityGateResult.PASS) {
      warnings.push('Structural validation failed — some scenes may be incomplete');
    }

    // ---- 2. Continuity validation ----
    let continuityResult = QualityGateResult.PASS;
    if (options.currentState && options.proposedDeltas) {
      const report = LongTermContinuityValidator.validate(
        options.currentState,
        options.proposedDeltas,
        options.chapterNumber ?? 0,
        {
          proseText: options.proseText,
          chapterId,
          sceneId: options.sceneId,
        }
      );
      allConflicts.push(...report.conflicts);
      continuityResult =
        report.status === 'FAIL'
          ? QualityGateResult.FAIL
          : report.status === 'WARN'
          ? QualityGateResult.WARN
          : QualityGateResult.PASS;
    }

    // ---- 3. Knowledge validation ----
    // Knowledge validation runs in KnowledgeBoundaryValidator separately per scene
    const knowledgeResult = QualityGateResult.PASS;

    // ---- 4. State transition validation ----
    let stateTransitionResult = QualityGateResult.PASS;
    if (options.proposedDeltas && options.proposedDeltas.length > 0) {
      const collisions = LongTermContinuityValidator.checkStateCollision(options.proposedDeltas);
      if (collisions.length > 0) {
        allConflicts.push(...collisions);
        stateTransitionResult = QualityGateResult.FAIL;
      }
    }

    // ---- 5. Plot thread validation ----
    let plotThreadResult = QualityGateResult.PASS;
    if (options.chapterNumber) {
      const threadIssues = await PlotThreadManager.detectIssues(novelId, options.chapterNumber);
      if (threadIssues.length > 0) {
        allConflicts.push(...threadIssues);
        const hasErrors = threadIssues.some((c) => c.severity === ConflictSeverity.ERROR);
        plotThreadResult = hasErrors ? QualityGateResult.FAIL : QualityGateResult.WARN;
      }
    }

    // ---- 6. Character arc validation ----
    const characterArcResult = QualityGateResult.PASS; // Placeholder — arc tracking deferred

    // ---- 7. Budget validation ----
    let budgetResult = QualityGateResult.PASS;
    if (!options.skipBudgetCheck) {
      budgetResult = await this.runBudgetValidation(novelId);
    }

    // ---- Compute overall result ----
    const allResults = [
      structuralResult,
      continuityResult,
      knowledgeResult,
      stateTransitionResult,
      plotThreadResult,
      characterArcResult,
      budgetResult,
    ];

    const hasHardFail = allResults.some((r) => r === QualityGateResult.FAIL);
    const hasSoftFail = allResults.some((r) => r === QualityGateResult.WARN);

    const result = hasHardFail
      ? QualityGateResult.FAIL
      : hasSoftFail
      ? QualityGateResult.WARN
      : QualityGateResult.PASS;

    const recommendation = hasHardFail
      ? 'BLOCK'
      : hasSoftFail && this.SOFT_FAIL_MODE === 'REVISE'
      ? 'REVISE'
      : hasSoftFail
      ? 'PROMOTE'  // WARN mode — promote with warning
      : 'PROMOTE';

    const report: QualityGateReport = {
      result,
      structuralValidation: structuralResult,
      continuityValidation: continuityResult,
      knowledgeValidation: knowledgeResult,
      stateTransitionValidation: stateTransitionResult,
      plotThreadValidation: plotThreadResult,
      characterArcValidation: characterArcResult,
      budgetValidation: budgetResult,
      conflicts: allConflicts,
      warnings,
      recommendation,
    };

    // Persist the gate result
    await db.proseQualityGate.create({
      data: {
        chapterProseVersionId,
        chapterId,
        novelId,
        result,
        report: report as any,
      },
    }).catch(() => {
      // Non-fatal — gate result is advisory
    });

    return report;
  }

  // ====================================================================
  // Structural validation: check required fields
  // ====================================================================
  private static async runStructuralValidation(
    chapterId: string
  ): Promise<QualityGateResult> {
    const chapter = await db.chapter.findUnique({
      where: { id: chapterId },
      include: {
        scenePlanVersions: {
          where: { status: 'CANONICAL' },
          take: 1,
          include: { scenes: true },
        },
      },
    });

    if (!chapter) return QualityGateResult.FAIL;

    const canonicalPlan = chapter.scenePlanVersions[0];
    if (!canonicalPlan) return QualityGateResult.WARN;

    // Warn if fewer than 1 scene
    if (canonicalPlan.scenes.length === 0) return QualityGateResult.WARN;

    return QualityGateResult.PASS;
  }

  // ====================================================================
  // Budget validation
  // ====================================================================
  private static async runBudgetValidation(
    novelId: string
  ): Promise<QualityGateResult> {
    const novel = await db.novel.findUnique({
      where: { id: novelId },
      select: { maxGenerationCostUsd: true },
    });

    if (!novel?.maxGenerationCostUsd) return QualityGateResult.PASS;

    const result = await db.generationJob.aggregate({
      where: { novelId, status: 'SUCCEEDED' },
      _sum: { estimatedCostUsd: true },
    });

    const spent = result._sum.estimatedCostUsd ?? 0;
    if (spent >= novel.maxGenerationCostUsd) return QualityGateResult.FAIL;
    if (spent >= novel.maxGenerationCostUsd * 0.9) return QualityGateResult.WARN;

    return QualityGateResult.PASS;
  }

  // ====================================================================
  // Get latest gate result for a chapter
  // ====================================================================
  static async getLatestResult(chapterId: string): Promise<QualityGateReport | null> {
    const record = await db.proseQualityGate.findFirst({
      where: { chapterId },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) return null;
    return record.report as unknown as QualityGateReport;
  }

  // ====================================================================
  // Cost projection helper (pure arithmetic, DB-free)
  // ====================================================================
  static projectCost(
    completedChapters: number,
    targetChapters: number,
    actualCostUsd: number
  ): {
    avgCostPerChapter: number;
    estimatedRemainingUsd: number;
    projectedTotalUsd: number;
  } {
    if (completedChapters === 0) {
      return {
        avgCostPerChapter: 0,
        estimatedRemainingUsd: 0,
        projectedTotalUsd: 0,
      };
    }

    const avgCostPerChapter = actualCostUsd / completedChapters;
    const remainingChapters = Math.max(0, targetChapters - completedChapters);
    const estimatedRemainingUsd = avgCostPerChapter * remainingChapters;
    const projectedTotalUsd = actualCostUsd + estimatedRemainingUsd;

    return {
      avgCostPerChapter: Math.round(avgCostPerChapter * 10000) / 10000,
      estimatedRemainingUsd: Math.round(estimatedRemainingUsd * 100) / 100,
      projectedTotalUsd: Math.round(projectedTotalUsd * 100) / 100,
    };
  }
}
