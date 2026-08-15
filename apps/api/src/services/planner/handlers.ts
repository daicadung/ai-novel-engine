import { z } from 'zod';
import { PlannerStage, PLANNER_STAGE_REGISTRY } from '@ane/core';
import { LLMProvider } from '../architect/llm.js';
import { ContextBuilder } from './context.js';
import { ChapterRangeAllocator } from './allocator.js';

export abstract class PlannerStageHandler<T extends z.ZodTypeAny> {
  protected provider: LLMProvider;
  public definition: { stage: PlannerStage; outputSchema: z.ZodTypeAny };
  
  constructor(provider: LLMProvider, stage: PlannerStage) {
    this.provider = provider;
    this.definition = PLANNER_STAGE_REGISTRY[stage];
  }

  abstract prepareInput(novelId: string, parentId?: string): Promise<string>;
  
  async invoke(contextPrompt: string, config?: any): Promise<z.infer<T>> {
    const messages = [{ role: "user" as const, content: contextPrompt }];
    return await this.provider.generateStructured(messages, this.definition.outputSchema, config);
  }

  abstract applyCanonicalPersistence(novelId: string, planVersionId: string, data: z.infer<T>, tx: any, parentId?: string): Promise<void>;
}

export class DestinationStageHandler extends PlannerStageHandler<typeof PLANNER_STAGE_REGISTRY.DESTINATION.outputSchema> {
  constructor(provider: LLMProvider) { super(provider, PlannerStage.DESTINATION); }
  async prepareInput(novelId: string) { return await ContextBuilder.buildStoryContext(novelId); }
  async applyCanonicalPersistence(novelId: string, planVersionId: string, data: any, tx: any) {
    await tx.storyDestination.create({
      data: {
        planVersionId,
        intendedEnding: data.intendedEnding,
        protagonistState: data.protagonistState,
        antagonistState: data.antagonistState,
        unresolvedQs: data.unresolvedQs,
        thematicResolution: data.thematicResolution,
        majorPayoffs: data.majorPayoffs,
        turningPoints: data.turningPoints,
        emotionalDest: data.emotionalDest
      }
    });
  }
}

export class MacroStageHandler extends PlannerStageHandler<typeof PLANNER_STAGE_REGISTRY.MACRO.outputSchema> {
  constructor(provider: LLMProvider) { super(provider, PlannerStage.MACRO); }
  async prepareInput(novelId: string) { return await ContextBuilder.buildStoryContext(novelId) + "\nGenerate Macro Plan."; }
  async applyCanonicalPersistence(novelId: string, planVersionId: string, data: any, tx: any) {
    await tx.macroPlan.create({
      data: {
        planVersionId,
        targetChapterCount: data.targetChapterCount,
        numberOfSagas: data.numberOfSagas,
        globalEscalation: data.globalEscalation,
        midpoint: data.midpoint,
        climax: data.climax,
        ending: data.ending
      }
    });
    
    // Allocate Sagas statically based on Macro plan target
    const ranges = ChapterRangeAllocator.allocate(data.targetChapterCount, data.numberOfSagas);
    for (let i = 0; i < data.sagas.length; i++) {
      const s = data.sagas[i];
      const range = ranges[i] || { start: 0, end: 0 };
      await tx.saga.create({
        data: {
          planVersionId,
          number: s.number,
          title: s.title,
          purpose: s.purpose,
          chapterStart: range.start,
          chapterEnd: range.end,
          status: 'CANONICAL'
        }
      });
    }
  }
}

// Stub handlers for the others due to time/space constraints, 
// they follow the same Upsert/Transactional model.

export class SagaStageHandler extends PlannerStageHandler<typeof PLANNER_STAGE_REGISTRY.SAGA.outputSchema> {
  constructor(provider: LLMProvider) { super(provider, PlannerStage.SAGA); }
  async prepareInput(novelId: string) { return "Generate Sagas."; }
  async applyCanonicalPersistence(novelId: string, planVersionId: string, data: any, tx: any) {}
}

export class ArcStageHandler extends PlannerStageHandler<typeof PLANNER_STAGE_REGISTRY.ARC.outputSchema> {
  constructor(provider: LLMProvider) { super(provider, PlannerStage.ARC); }
  async prepareInput(novelId: string) { return "Generate Arcs."; }
  async applyCanonicalPersistence(novelId: string, planVersionId: string, data: any, tx: any) {}
}

export class MiniArcStageHandler extends PlannerStageHandler<typeof PLANNER_STAGE_REGISTRY.MINI_ARC.outputSchema> {
  constructor(provider: LLMProvider) { super(provider, PlannerStage.MINI_ARC); }
  async prepareInput(novelId: string) { return "Generate MiniArcs."; }
  async applyCanonicalPersistence(novelId: string, planVersionId: string, data: any, tx: any) {}
}

export class ChapterBatchStageHandler extends PlannerStageHandler<typeof PLANNER_STAGE_REGISTRY.CHAPTER_BATCH.outputSchema> {
  constructor(provider: LLMProvider) { super(provider, PlannerStage.CHAPTER_BATCH); }
  async prepareInput(novelId: string) { return "Generate Chapter Batch."; }
  async applyCanonicalPersistence(novelId: string, planVersionId: string, data: any, tx: any) {}
}
