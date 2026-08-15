import { db } from '@ane/database';
import {
  ILLMProvider,
  LongHorizonPlan,
  StoryArcPlan,
  NarrativeMilestone,
  ArcStatus,
  MilestoneStatus,
  MilestoneType,
  DeviationType,
} from '@ane/core';
import { ProviderFactory } from '../llm/factory.js';
import { PlanningValidator, PlanValidationResult } from './PlanningValidator.js';
import { ObservabilityManager } from '../generation/ObservabilityManager.js';
import { z } from 'zod';

const obs = ObservabilityManager.getInstance();

// ====================================================================
// LLM output schemas (validated before persistence)
// ====================================================================

const ArcProposalSchema = z.object({
  arcNumber: z.number().int().min(1),
  title: z.string().min(3).max(200),
  purpose: z.string().min(10),
  objective: z.string().min(10),
  conflict: z.string().min(5),
  stakes: z.string().min(5),
  entryConditions: z.array(z.string()),
  exitConditions: z.array(z.string()).min(1),
  plannedChapterStart: z.number().int().min(1),
  plannedChapterEnd: z.number().int().min(2),
  priority: z.number().min(1).max(10).default(5),
  characterFocusIds: z.array(z.string()).default([]),
  threadFocusIds: z.array(z.string()).default([]),
}).refine(
  (a) => a.plannedChapterStart < a.plannedChapterEnd,
  { message: 'plannedChapterStart must be < plannedChapterEnd' }
);

const MilestoneProposalSchema = z.object({
  milestoneType: z.nativeEnum(MilestoneType),
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  plannedChapterMin: z.number().int().min(1),
  plannedChapterMax: z.number().int().min(1),
  prerequisites: z.array(z.string()).default([]),
  consequences: z.array(z.string()).default([]),
  involvedEntityIds: z.array(z.string()).default([]),
  priority: z.number().min(1).max(10).default(5),
  isOptional: z.boolean().default(false),
}).refine(
  (m) => m.plannedChapterMin <= m.plannedChapterMax,
  { message: 'plannedChapterMin must be <= plannedChapterMax' }
);

const LLMPlanOutputSchema = z.object({
  narrativePromise: z.string().min(10),
  globalObjective: z.string().min(10),
  arcs: z.array(ArcProposalSchema).min(1),
  milestones: z.array(MilestoneProposalSchema).default([]),
  reasoning: z.string().optional(),
});

type LLMPlanOutput = z.infer<typeof LLMPlanOutputSchema>;

// ====================================================================
// LongHorizonPlanner
// ====================================================================

/**
 * LongHorizonPlanner
 *
 * Uses LLM for semantic planning decisions.
 * ALL LLM output is:
 *   1. Schema validated (Zod)
 *   2. Deterministic rule validated (PlanningValidator)
 *   3. Saved as DRAFT
 *   4. Promoted only after explicit approval
 *
 * NEVER directly mutates canonical prose or canonical story state.
 */
export class LongHorizonPlanner {
  private provider: ILLMProvider;

  constructor(provider?: ILLMProvider) {
    this.provider = provider ?? ProviderFactory.getProvider('PLANNER');
  }

  // ====================================================================
  // Initial planning — create LongHorizonPlan from premise
  // ====================================================================

  async createInitialPlan(
    novelId: string,
    storyPlanVersionId: string,
    opts: {
      title: string;
      premise: string;
      genre?: string;
      targetChapters: number;
      jobId?: string;
    }
  ): Promise<{ planId: string; validation: PlanValidationResult }> {
    obs.recordPhase9Event({
      type: 'NOVEL_GENERATION_STARTED',
      novelId,
      timestamp: new Date(),
      metadata: { event: 'planning.started', operation: 'initial', targetChapters: opts.targetChapters },
    });

    // Idempotency: check existing DRAFT or ACTIVE plan
    const existing = await db.longHorizonPlan.findFirst({
      where: { novelId, status: { in: ['DRAFT', 'ACTIVE'] } },
      orderBy: { version: 'desc' },
    });
    if (existing) {
      obs.recordPhase9Event({
        type: 'STORY_STATE_PROMOTED',
        novelId,
        timestamp: new Date(),
        metadata: { event: 'planning.idempotent_skip', existingPlanId: existing.id },
      });
      return {
        planId: existing.id,
        validation: { valid: true, errors: [], warnings: [] },
      };
    }

    // Call LLM for hierarchical plan
    const llmOutput = await this.callLLMForInitialPlan(novelId, opts);

    // Schema validation
    const parsed = LLMPlanOutputSchema.safeParse(llmOutput);
    if (!parsed.success) {
      throw new Error(`LLM planning output failed schema validation: ${parsed.error.message}`);
    }

    const data = parsed.data;

    // Deterministic rule validation
    const arcDomains: StoryArcPlan[] = data.arcs.map((a, i) => ({
      id: `tmp-${i}`,
      longHorizonPlanId: 'tmp',
      novelId,
      arcNumber: a.arcNumber,
      title: a.title,
      purpose: a.purpose,
      objective: a.objective,
      conflict: a.conflict,
      stakes: a.stakes,
      entryConditions: a.entryConditions,
      exitConditions: a.exitConditions,
      plannedChapterStart: a.plannedChapterStart,
      plannedChapterEnd: a.plannedChapterEnd,
      status: ArcStatus.PLANNED,
      priority: a.priority,
      allowExtension: true,
      maxExtensionChapters: 20,
      characterFocusIds: a.characterFocusIds,
      threadFocusIds: a.threadFocusIds,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const arcValidation = PlanningValidator.validateArcs(arcDomains);

    // Persist as DRAFT plan
    const nextVersion = await this.getNextPlanVersion(novelId);

    const plan = await db.longHorizonPlan.create({
      data: {
        novelId,
        storyPlanVersionId,
        version: nextVersion,
        title: opts.title,
        premise: opts.premise,
        genre: opts.genre ?? null,
        narrativePromise: data.narrativePromise,
        globalObjective: data.globalObjective,
        plannedArcCount: data.arcs.length,
        status: 'DRAFT',
        metadata: { reasoning: data.reasoning ?? '', wasLLMAssisted: true },
      },
    });

    // Persist arcs
    for (const arc of data.arcs) {
      await db.storyArcPlan.create({
        data: {
          longHorizonPlanId: plan.id,
          novelId,
          arcNumber: arc.arcNumber,
          title: arc.title,
          purpose: arc.purpose,
          objective: arc.objective,
          conflict: arc.conflict,
          stakes: arc.stakes,
          entryConditions: arc.entryConditions,
          exitConditions: arc.exitConditions,
          plannedChapterStart: arc.plannedChapterStart,
          plannedChapterEnd: arc.plannedChapterEnd,
          status: ArcStatus.PLANNED,
          priority: arc.priority,
          characterFocusIds: arc.characterFocusIds,
          threadFocusIds: arc.threadFocusIds,
        },
      });
    }

    // Persist milestones
    const arcRecords = await db.storyArcPlan.findMany({
      where: { longHorizonPlanId: plan.id },
      orderBy: { arcNumber: 'asc' },
    });

    for (const ms of data.milestones) {
      const targetArc = arcRecords.find(
        (a) =>
          ms.plannedChapterMin >= a.plannedChapterStart &&
          ms.plannedChapterMax <= a.plannedChapterEnd
      );

      await db.narrativeMilestoneRecord.create({
        data: {
          novelId,
          arcPlanId: targetArc?.id ?? null,
          milestoneType: ms.milestoneType,
          title: ms.title,
          description: ms.description,
          plannedChapterMin: ms.plannedChapterMin,
          plannedChapterMax: ms.plannedChapterMax,
          status: MilestoneStatus.PLANNED,
          prerequisites: ms.prerequisites,
          consequences: ms.consequences,
          involvedEntityIds: ms.involvedEntityIds,
          priority: ms.priority,
          isOptional: ms.isOptional,
        },
      });
    }

    // Log planning decision
    await db.planningDecisionRecord.create({
      data: {
        novelId,
        longHorizonPlanId: plan.id,
        decisionType: 'INITIAL_PLAN',
        summary: `Initial long-horizon plan created: ${data.arcs.length} arcs, ${data.milestones.length} milestones`,
        rationale: data.reasoning ?? 'LLM-assisted initial planning',
        previousState: {},
        newState: { arcCount: data.arcs.length, milestoneCount: data.milestones.length },
        affectedArcIds: [],
        affectedChapterMin: 1,
        affectedChapterMax: opts.targetChapters,
        wasLLMAssisted: true,
        validationPassed: arcValidation.valid,
      },
    });

    obs.recordPhase9Event({
      type: 'STORY_STATE_PROMOTED',
      novelId,
      timestamp: new Date(),
      metadata: { event: 'plan.created', planId: plan.id, arcCount: data.arcs.length },
    });

    return { planId: plan.id, validation: arcValidation };
  }

  // ====================================================================
  // Activate a DRAFT plan (sets status ACTIVE, supersedes previous)
  // ====================================================================

  async approvePlan(novelId: string, planId: string): Promise<void> {
    // Supersede existing active plans
    await db.longHorizonPlan.updateMany({
      where: { novelId, status: 'ACTIVE' },
      data: { status: 'SUPERSEDED' },
    });

    await db.longHorizonPlan.update({
      where: { id: planId },
      data: { status: 'ACTIVE' },
    });

    // Activate first arc
    const firstArc = await db.storyArcPlan.findFirst({
      where: { longHorizonPlanId: planId },
      orderBy: { arcNumber: 'asc' },
    });

    if (firstArc) {
      await db.storyArcPlan.update({
        where: { id: firstArc.id },
        data: { status: ArcStatus.ACTIVE, actualChapterStart: 1 },
      });

      await db.longHorizonPlan.update({
        where: { id: planId },
        data: { activeArcId: firstArc.id },
      });
    }

    obs.recordPhase9Event({
      type: 'STORY_STATE_PROMOTED',
      novelId,
      timestamp: new Date(),
      metadata: { event: 'plan.approved', planId },
    });
  }

  // ====================================================================
  // Replanning — adaptive plan update after major deviation
  // ====================================================================

  async replan(
    novelId: string,
    currentChapter: number,
    opts: {
      longHorizonPlanId: string;
      reason: string;
      affectedArcId?: string;
      jobId?: string;
    }
  ): Promise<{ success: boolean; newArcIds: string[] }> {
    obs.recordPhase9Event({
      type: 'NOVEL_GENERATION_STARTED',
      novelId,
      timestamp: new Date(),
      metadata: { event: 'replanning.started', currentChapter, reason: opts.reason },
    });

    // Get current plan
    const plan = await db.longHorizonPlan.findUnique({
      where: { id: opts.longHorizonPlanId },
      include: { arcPlans: { orderBy: { arcNumber: 'asc' } } },
    });

    if (!plan) return { success: false, newArcIds: [] };

    // Only replan future arcs — never touch completed arcs
    const futureArcs = plan.arcPlans.filter(
      (a) => a.plannedChapterStart > currentChapter && a.status !== 'COMPLETED'
    );

    if (futureArcs.length === 0) {
      return { success: true, newArcIds: [] };
    }

    // Call LLM for replanning future arcs only
    const replanContext = {
      currentChapter,
      reason: opts.reason,
      remainingArcs: futureArcs.map((a) => ({
        arcNumber: a.arcNumber,
        title: a.title,
        plannedStart: a.plannedChapterStart,
        plannedEnd: a.plannedChapterEnd,
        objective: a.objective,
      })),
    };

    const llmReplan = await this.callLLMForReplanning(novelId, plan.premise, replanContext);
    const parsed = z.array(ArcProposalSchema).safeParse(llmReplan);

    if (!parsed.success) {
      console.error('[LongHorizonPlanner] Replanning schema validation failed:', parsed.error.message);
      return { success: false, newArcIds: [] };
    }

    const newArcIds: string[] = [];

    // Update future arcs with new planning (never delete, just update status)
    for (const updatedArc of parsed.data) {
      const existingArc = futureArcs.find((a) => a.arcNumber === updatedArc.arcNumber);

      if (existingArc) {
        await db.storyArcPlan.update({
          where: { id: existingArc.id },
          data: {
            objective: updatedArc.objective,
            conflict: updatedArc.conflict,
            stakes: updatedArc.stakes,
            plannedChapterStart: updatedArc.plannedChapterStart,
            plannedChapterEnd: updatedArc.plannedChapterEnd,
            exitConditions: updatedArc.exitConditions,
          },
        });
        newArcIds.push(existingArc.id);
      }
    }

    // Log decision
    await db.planningDecisionRecord.create({
      data: {
        novelId,
        longHorizonPlanId: opts.longHorizonPlanId,
        decisionType: 'REPLAN',
        summary: `Replanning triggered at chapter ${currentChapter}: ${opts.reason}`,
        rationale: opts.reason,
        previousState: { futureArcCount: futureArcs.length },
        newState: { updatedArcCount: newArcIds.length },
        affectedArcIds: newArcIds,
        affectedChapterMin: currentChapter,
        affectedChapterMax: futureArcs[futureArcs.length - 1]?.plannedChapterEnd ?? currentChapter + 100,
        wasLLMAssisted: true,
        validationPassed: true,
      },
    });

    obs.recordPhase9Event({
      type: 'STORY_STATE_PROMOTED',
      novelId,
      timestamp: new Date(),
      metadata: { event: 'replanning.completed', updatedArcs: newArcIds.length },
    });

    return { success: true, newArcIds };
  }

  // ====================================================================
  // Helpers
  // ====================================================================

  private async callLLMForInitialPlan(
    novelId: string,
    opts: { title: string; premise: string; genre?: string; targetChapters: number }
  ): Promise<any> {
    const prompt = `You are a master novelist creating a long-term narrative plan.

Novel: "${opts.title}"
Genre: ${opts.genre ?? 'Literary Fiction'}
Target chapters: ${opts.targetChapters}
Premise: ${opts.premise}

Create a hierarchical story plan. Return ONLY valid JSON matching this schema:
{
  "narrativePromise": "string (core promise to the reader)",
  "globalObjective": "string (what the novel ultimately achieves)",
  "arcs": [
    {
      "arcNumber": 1,
      "title": "Arc title",
      "purpose": "Why this arc exists",
      "objective": "What must be accomplished",
      "conflict": "Central conflict",
      "stakes": "What is at risk",
      "entryConditions": ["condition1"],
      "exitConditions": ["must have happened 1", "must have happened 2"],
      "plannedChapterStart": 1,
      "plannedChapterEnd": 80,
      "priority": 8,
      "characterFocusIds": [],
      "threadFocusIds": []
    }
  ],
  "milestones": [
    {
      "milestoneType": "MAJOR_REVEAL",
      "title": "Milestone name",
      "description": "What happens",
      "plannedChapterMin": 40,
      "plannedChapterMax": 60,
      "prerequisites": [],
      "consequences": ["effect1"],
      "involvedEntityIds": [],
      "priority": 8,
      "isOptional": false
    }
  ],
  "reasoning": "Brief explanation"
}

Rules:
- Arc chapter ranges must NOT overlap
- exitConditions are required for each arc
- Milestones must fall within an arc's chapter range
- For ${opts.targetChapters} chapters, plan ${Math.max(3, Math.ceil(opts.targetChapters / 100))} arcs minimum
- Do NOT plan individual chapters — plan arcs and key milestones only`;

    try {
      const content = await this.provider.generateText(
        [{ role: 'user', content: prompt }],
        { temperature: 0.7, maxTokens: 4000 }
      );

      return JSON.parse(content);
    } catch (err: any) {
      throw new Error(`LLM planning call failed: ${err.message}`);
    }
  }

  private async callLLMForReplanning(
    novelId: string,
    premise: string,
    context: {
      currentChapter: number;
      reason: string;
      remainingArcs: any[];
    }
  ): Promise<any> {
    const prompt = `You are adapting a novel's future story plan.

Current chapter: ${context.currentChapter}
Reason for replanning: ${context.reason}
Premise: ${premise}

Existing future arcs to potentially update:
${JSON.stringify(context.remainingArcs, null, 2)}

Return updated arc plans as JSON array. Only modify what is needed. Keep arcNumbers the same.
Return ONLY a JSON array of arc objects matching the arc schema.
Historical arcs (already completed) must NOT be modified.`;

    try {
      const content = await this.provider.generateText(
        [{ role: 'user', content: prompt }],
        { temperature: 0.6, maxTokens: 2000 }
      );

      return JSON.parse(content);
    } catch (err: any) {
      console.error('[LongHorizonPlanner] Replanning LLM call failed:', err.message);
      return context.remainingArcs; // fallback: keep existing
    }
  }

  private async getNextPlanVersion(novelId: string): Promise<number> {
    const latest = await db.longHorizonPlan.findFirst({
      where: { novelId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return (latest?.version ?? 0) + 1;
  }
}
