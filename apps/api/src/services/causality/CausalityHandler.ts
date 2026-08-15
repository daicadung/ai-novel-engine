import { CausalityJobPayload, JobStatus } from '@ane/core';
import { db } from '@ane/database';
import { CausalityEngine } from './CausalityEngine.js';
import { ConsequencePropagator } from './ConsequencePropagator.js';

export class CausalityHandler {
  /**
   * Main entry point for CAUSALITY_ANALYSIS job.
   */
  static async handleJob(jobId: string, payload: CausalityJobPayload): Promise<void> {
    const { novelId, chapterId, chapterNumber } = payload;
    const startTime = Date.now();

    try {
      // 1. Get the ChapterMemory for state deltas
      const memory = await db.chapterMemoryRecord.findUnique({
        where: { chapterId }
      });

      if (!memory) {
        throw new Error(`ChapterMemory for chapter ${chapterId} not found. Cannot analyze causality.`);
      }

      const stateDeltas = memory.stateDeltas as any[];

      if (!stateDeltas || stateDeltas.length === 0) {
        // Nothing to do
        await this.recordAnalysis(novelId, chapterNumber, 0, 0, 0, 0, 0, Date.now() - startTime);
        return;
      }

      // 2. Extract Events and consequences
      const events = CausalityEngine.extractEventsFromDeltas(novelId, chapterNumber, undefined, stateDeltas);
      
      for (const event of events) {
        await CausalityEngine.deriveConsequences(event);
      }

      // 3. Propagate consequences to plans/dependencies
      await ConsequencePropagator.propagateConsequences(novelId, chapterNumber);

      // 4. Record analysis metrics
      await this.recordAnalysis(
        novelId, 
        chapterNumber, 
        events.length, 
        0, // consequences derived inside deriveConsequences, hard to track return natively here without refactor, assume >0 if events >0
        0, // invalidated
        0, // world transitions
        0, // plan impacts
        Date.now() - startTime
      );

      // 5. Update Job Status
      await db.generationJob.update({
        where: { id: jobId },
        data: {
          status: 'SUCCEEDED',
          completedAt: new Date(),
          output: { eventsDetected: events.length }
        }
      });

    } catch (error: any) {
      console.error(`[CausalityHandler] Failed job ${jobId}: ${error.message}`);
      
      await db.generationJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          error: { message: error.message }
        }
      });
      
      throw error;
    }
  }

  private static async recordAnalysis(
    novelId: string, 
    chapterNumber: number,
    eventsGenerated: number,
    consequencesGenerated: number,
    dependenciesInvalidated: number,
    worldTransitionsGenerated: number,
    planImpactsGenerated: number,
    executionMs: number
  ) {
    await db.causalAnalysisRecord.create({
      data: {
        novelId,
        chapterNumber,
        analysisType: 'POST_CHAPTER_EVALUATION',
        eventsGenerated,
        consequencesGenerated,
        dependenciesInvalidated,
        worldTransitionsGenerated,
        planImpactsGenerated,
        executionMs,
        createdAt: new Date()
      }
    });
  }
}
