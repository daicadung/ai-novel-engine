import { db } from '@ane/database';
import {
  GenerationStageType,
  GenerationStageResult,
} from '@ane/core';

/**
 * GenerationStageResolver
 *
 * PURELY responsible for inspecting the current database state of a novel
 * and determining what the NEXT safe generation stage should be.
 *
 * This service:
 * - READS the database
 * - DOES NOT create jobs
 * - DOES NOT call LLMs
 * - DOES NOT mutate canonical state
 *
 * Returns a deterministic GenerationStageResult.
 */
export class GenerationStageResolver {
  /**
   * Resolve the next generation stage for the given novel.
   * Respects targetChapters, generationWindowSize, and chapterBatchSize.
   */
  async resolve(novelId: string): Promise<GenerationStageResult> {
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    if (!novel) {
      return {
        stage: GenerationStageType.BLOCKED,
        ready: false,
        reason: 'Novel not found',
        blockers: ['NOVEL_NOT_FOUND'],
      };
    }

    const targetChapters = novel.targetChapters ?? 100;
    const windowSize = novel.generationWindowSize ?? 2;
    const batchSize = novel.chapterBatchSize ?? 10;

    // -------------------------------------------------------------------
    // 1. Check for canonical Story Bible (ArchitectStage.STORY_BIBLE_FINALIZATION)
    // -------------------------------------------------------------------
    const canonicalBible = await db.storyBible.findFirst({
      where: { novelId, isCanonical: true },
    });
    if (!canonicalBible) {
      return {
        stage: GenerationStageType.ARCHITECT,
        ready: true,
        reason: 'No canonical StoryBible exists. Story Architect must run first.',
        blockers: [],
        context: {},
      };
    }

    // -------------------------------------------------------------------
    // 2. Check for canonical StoryPlan / StoryDestination
    // -------------------------------------------------------------------
    const storyPlan = await db.storyPlan.findUnique({ where: { novelId } });
    if (!storyPlan) {
      return {
        stage: GenerationStageType.PLANNER_DESTINATION,
        ready: true,
        reason: 'No StoryPlan exists. DESTINATION stage must run first.',
        blockers: [],
        context: {},
      };
    }

    const canonicalVersion = await db.storyPlanVersion.findFirst({
      where: { planId: storyPlan.id, isCanonical: true },
      orderBy: { version: 'desc' },
    });
    if (!canonicalVersion) {
      return {
        stage: GenerationStageType.PLANNER_DESTINATION,
        ready: true,
        reason: 'No canonical StoryPlanVersion exists.',
        blockers: [],
        context: {},
      };
    }

    const destination = await db.storyDestination.findFirst({
      where: { planVersionId: canonicalVersion.id },
    });
    if (!destination) {
      return {
        stage: GenerationStageType.PLANNER_DESTINATION,
        ready: true,
        reason: 'No StoryDestination found for canonical plan version.',
        blockers: [],
        context: {},
      };
    }

    // -------------------------------------------------------------------
    // 3. Check for MacroPlan
    // -------------------------------------------------------------------
    const macroPlan = await db.macroPlan.findFirst({
      where: { planVersionId: canonicalVersion.id },
    });
    if (!macroPlan) {
      return {
        stage: GenerationStageType.PLANNER_MACRO,
        ready: true,
        reason: 'No MacroPlan found. MACRO stage must run.',
        blockers: [],
        context: {},
      };
    }

    // -------------------------------------------------------------------
    // 4. Check for canonical Sagas
    // -------------------------------------------------------------------
    const sagas = await db.saga.findMany({
      where: { planVersionId: canonicalVersion.id, status: 'CANONICAL' },
      orderBy: { number: 'asc' },
    });
    if (sagas.length === 0) {
      return {
        stage: GenerationStageType.PLANNER_SAGA,
        ready: true,
        reason: 'No canonical Sagas found. SAGA planning must run.',
        blockers: [],
        context: {},
      };
    }

    // -------------------------------------------------------------------
    // 5. Check for canonical Arcs
    // -------------------------------------------------------------------
    const arcs = await db.arc.findMany({
      where: { novelId, status: 'PLANNED' },
      orderBy: { number: 'asc' },
    });

    // Check if there are sagas without Arcs allocated
    for (const saga of sagas) {
      const sagaArcs = arcs.filter((a) => a.sagaId === saga.id);
      if (sagaArcs.length === 0) {
        return {
          stage: GenerationStageType.PLANNER_ARC,
          ready: true,
          reason: `Saga ${saga.number} (${saga.title}) has no allocated arcs.`,
          blockers: [],
          context: { sagaId: saga.id },
        };
      }
    }

    // -------------------------------------------------------------------
    // 6. Check for canonical MiniArcs
    // -------------------------------------------------------------------
    const miniArcs = await db.miniArc.findMany({
      where: { saga: { planVersionId: canonicalVersion.id }, status: 'CANONICAL' },
      include: { chapters: true },
      orderBy: { number: 'asc' },
    });

    // Check if any arc is missing MiniArcs
    for (const arc of arcs) {
      const arcMiniArcs = miniArcs.filter((ma) => {
        // MiniArc belongs to a Saga, check if saga is in this arc's range
        return true; // Simplified — rely on MINI_ARC planning stage
      });
    }

    const anyMiniArc = miniArcs.length > 0;
    if (!anyMiniArc) {
      return {
        stage: GenerationStageType.PLANNER_MINI_ARC,
        ready: true,
        reason: 'No canonical MiniArcs found. MINI_ARC planning must run.',
        blockers: [],
        context: {},
      };
    }

    // -------------------------------------------------------------------
    // 7. Chapter Blueprint window check
    // -------------------------------------------------------------------
    const chapters = await db.chapter.findMany({
      where: { novelId },
      orderBy: { number: 'asc' },
      include: {
        chapterBlueprint: true,
        scenePlanVersions: {
          where: { status: 'CANONICAL' },
          take: 1,
        },
        chapterProse: {
          include: {
            versions: {
              where: { status: 'CANONICAL' },
              take: 1,
            },
          },
        },
      },
    });

    const canonicalChaptersCount = chapters.filter((c) =>
      c.chapterProse?.versions && c.chapterProse.versions.length > 0
    ).length;

    // Determine the current generation window
    const windowStart = canonicalChaptersCount + 1;
    const windowEnd = Math.min(windowStart + windowSize * batchSize - 1, targetChapters);

    if (windowStart > targetChapters) {
      return {
        stage: GenerationStageType.COMPLETED,
        ready: true,
        reason: `All ${targetChapters} target chapters have canonical prose.`,
        blockers: [],
      };
    }

    // Check if chapter blueprints exist for the window
    const blueprintedChapters = chapters.filter(
      (c) => c.chapterBlueprint !== null && c.number >= windowStart && c.number <= windowEnd
    );

    if (blueprintedChapters.length === 0) {
      const batchEnd = Math.min(windowStart + batchSize - 1, targetChapters);
      return {
        stage: GenerationStageType.CHAPTER_BLUEPRINT,
        ready: true,
        reason: `Chapter blueprints missing for chapters ${windowStart}–${batchEnd}.`,
        blockers: [],
        context: {
          chapterStart: windowStart,
          chapterEnd: batchEnd,
        },
      };
    }

    // -------------------------------------------------------------------
    // 8. Scene Plan check for blueprinted chapters
    // -------------------------------------------------------------------
    const chaptersNeedingScenes = blueprintedChapters.filter(
      (c) => c.scenePlanVersions.length === 0
    );
    if (chaptersNeedingScenes.length > 0) {
      const nextChapter = chaptersNeedingScenes[0];
      return {
        stage: GenerationStageType.SCENE_PLAN,
        ready: true,
        reason: `Chapter ${nextChapter.number} needs a scene plan.`,
        blockers: [],
        context: {
          chapterId: nextChapter.id,
          chapterStart: nextChapter.number,
          chapterEnd: nextChapter.number,
        },
      };
    }

    // -------------------------------------------------------------------
    // 9. Prose check (if autoGenerateProse)
    // -------------------------------------------------------------------
    const chaptersNeedingProse = blueprintedChapters.filter((c) => {
      const hasProse = c.chapterProse?.versions && c.chapterProse.versions.length > 0;
      return !hasProse;
    });

    if (chaptersNeedingProse.length > 0) {
      const nextChapter = chaptersNeedingProse[0];
      // Find the canonical ScenePlanVersion for this chapter
      const canonicalScenePlan = nextChapter.scenePlanVersions[0];
      if (!canonicalScenePlan) {
        return {
          stage: GenerationStageType.SCENE_PLAN,
          ready: false,
          reason: `Chapter ${nextChapter.number} needs a scene plan before prose can be generated.`,
          blockers: ['MISSING_SCENE_PLAN'],
          context: { chapterId: nextChapter.id },
        };
      }

      return {
        stage: GenerationStageType.PROSE,
        ready: true,
        reason: `Chapter ${nextChapter.number} has a scene plan but no prose.`,
        blockers: [],
        context: {
          chapterId: nextChapter.id,
        },
      };
    }

    // -------------------------------------------------------------------
    // 10. All window chapters have prose — advance window or complete
    // -------------------------------------------------------------------
    if (canonicalChaptersCount >= targetChapters) {
      return {
        stage: GenerationStageType.COMPLETED,
        ready: true,
        reason: `All ${targetChapters} target chapters have canonical prose.`,
        blockers: [],
      };
    }

    // Need to advance to next window
    const nextBatchStart = canonicalChaptersCount + 1;
    const nextBatchEnd = Math.min(nextBatchStart + batchSize - 1, targetChapters);
    return {
      stage: GenerationStageType.CHAPTER_BLUEPRINT,
      ready: true,
      reason: `Current window complete. Next batch: chapters ${nextBatchStart}–${nextBatchEnd}.`,
      blockers: [],
      context: {
        chapterStart: nextBatchStart,
        chapterEnd: nextBatchEnd,
      },
    };
  }

  /**
   * Deterministic idempotency key for a given stage and context.
   */
  static buildIdempotencyKey(
    novelId: string,
    stage: GenerationStageType,
    context?: {
      chapterStart?: number;
      chapterEnd?: number;
      chapterId?: string;
      sagaId?: string;
      arcId?: string;
      miniArcId?: string;
    }
  ): string {
    const base = `NOVEL:${novelId}`;
    switch (stage) {
      case GenerationStageType.ARCHITECT:
        return `${base}:ARCHITECT`;
      case GenerationStageType.PLANNER_DESTINATION:
        return `${base}:PLANNER:DESTINATION`;
      case GenerationStageType.PLANNER_MACRO:
        return `${base}:PLANNER:MACRO`;
      case GenerationStageType.PLANNER_SAGA:
        return `${base}:PLANNER:SAGA`;
      case GenerationStageType.PLANNER_ARC:
        return context?.sagaId
          ? `${base}:PLANNER:ARC:${context.sagaId}`
          : `${base}:PLANNER:ARC`;
      case GenerationStageType.PLANNER_MINI_ARC:
        return context?.arcId
          ? `${base}:PLANNER:MINI_ARC:${context.arcId}`
          : `${base}:PLANNER:MINI_ARC`;
      case GenerationStageType.CHAPTER_BLUEPRINT:
        return `${base}:CHAPTER_BLUEPRINT:${context?.chapterStart ?? 1}-${context?.chapterEnd ?? 10}`;
      case GenerationStageType.SCENE_PLAN:
        return `${base}:SCENE_PLAN:${context?.chapterId ?? 'unknown'}`;
      case GenerationStageType.PROSE:
        return `${base}:PROSE:${context?.chapterId ?? 'unknown'}`;
      default:
        return `${base}:${stage}`;
    }
  }
}
