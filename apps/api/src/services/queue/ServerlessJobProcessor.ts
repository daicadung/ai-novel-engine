import { db } from '@ane/database';
import { JobDispatcher } from './JobDispatcher.js';
import { JobType } from '@ane/core';

const JOB_LOCK_TIMEOUT_MS = parseInt(process.env.JOB_LOCK_TIMEOUT_MS || '180000', 10);
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3', 10);
const JOB_BATCH_SIZE = parseInt(process.env.JOB_BATCH_SIZE || '3', 10);
const JOB_PROCESSOR_TIMEOUT_MS = parseInt(process.env.JOB_PROCESSOR_TIMEOUT_MS || '50000', 10);

export interface ProcessorResult {
  processed: number;
  succeeded: number;
  failed: number;
  retryPending: number;
  recovered: number;
}

export class ServerlessJobProcessor {
  private dispatcher = new JobDispatcher();

  async processNextBatch(batchSize: number = JOB_BATCH_SIZE): Promise<ProcessorResult> {
    // Unique worker ID for lock tracking
    const workerId = `worker-${crypto.randomUUID()}`;

    // Soft processor deadline: stop CLAIMING new jobs after this timestamp
    const deadline = Date.now() + JOB_PROCESSOR_TIMEOUT_MS;

    const results: ProcessorResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      retryPending: 0,
      recovered: 0,
    };

    // 1. Recover stale jobs first
    results.recovered = await this.recoverStaleJobs();

    // 2. Claim jobs — up to batchSize, but stop if we're near the soft deadline
    for (let i = 0; i < batchSize; i++) {
      // SOFT DEADLINE CHECK: before claiming each new job, check if we still have time
      if (Date.now() >= deadline) {
        break;
      }

      const job = await this.claimNextJob(workerId);
      if (!job) break; // No more eligible jobs

      results.processed++;

      // Transition to RUNNING — this is separate from the claim transaction
      // so we don't hold the DB lock during LLM execution
      try {
        await db.generationJob.update({
          where: { id: job.id },
          data: { status: 'RUNNING', startedAt: new Date() }
        });
      } catch (updateErr: any) {
        // If the update failed, the job may have already been processed by another worker
        // Skip it to avoid double-processing
        results.processed--;
        continue;
      }

      // Determine job type from input payload
      const payload = job.input as any;
      let type: JobType = JobType.PROSE_GENERATION;
      if (job.stage) type = JobType.ARCHITECT_STAGE;
      else if (job.plannerStage) type = JobType.PLANNER_STAGE;
      else if (job.sceneStage) type = JobType.SCENE_GENERATION;
      else if (job.proseStage) type = JobType.PROSE_GENERATION;
      else if (payload?.type && Object.values(JobType).includes(payload.type)) {
        type = payload.type;
      }

      // Execute the job — do NOT abort this even if deadline is reached
      // The soft deadline only gates claiming new jobs
      const startTime = Date.now();
      try {
        const result = await this.dispatcher.dispatch(type, payload, job.id);
        const latencyMs = Date.now() - startTime;

        // Persist success with observability fields
        const usageUpdate: Record<string, any> = {
          status: 'SUCCEEDED',
          output: result || {},
          completedAt: new Date(),
        };

        // Pull usage metrics from payload if dispatcher propagated them
        if (result?.usage) {
          usageUpdate.inputTokens = result.usage.inputTokens;
          usageUpdate.outputTokens = result.usage.outputTokens;
          usageUpdate.totalTokens = result.usage.totalTokens;
          usageUpdate.estimatedCostUsd = result.usage.estimatedCostUsd;
          usageUpdate.provider = result.usage.provider;
          usageUpdate.model = result.usage.model;
        }

        await db.generationJob.update({
          where: { id: job.id },
          data: usageUpdate,
        });
        results.succeeded++;

        // AUTO-CONTINUE: If the novel has autoContinue enabled, trigger the next
        // safe orchestration step. This does NOT call any LLM — it only evaluates
        // what the next job should be and creates a GenerationJob record.
        // The next Cron invocation will execute that job.
        try {
          const novelForContinue = await db.novel.findUnique({ where: { id: job.novelId } });
          if (novelForContinue?.autoContinue) {
            const { NovelGenerationOrchestrator } = await import('../generation/NovelGenerationOrchestrator.js');
            const orchestrator = new NovelGenerationOrchestrator();
            await orchestrator.advance(job.novelId);
          }
        } catch (continueErr: any) {
          // AutoContinue errors must never affect the job result
          // Log the error but do not rethrow
          console.warn(`[AutoContinue] Failed to advance novel ${job.novelId}: ${continueErr.message}`);
        }

      } catch (error: any) {
        const retryCount = job.retryCount + 1;

        if (retryCount <= (job.maxRetries ?? MAX_RETRIES)) {
          // Exponential backoff: 2^retryCount seconds
          const delayMs = Math.pow(2, retryCount) * 1000;
          await db.generationJob.update({
            where: { id: job.id },
            data: {
              status: 'RETRY_PENDING',
              retryCount,
              scheduledAt: new Date(Date.now() + delayMs),
              lockedAt: null,
              lockedBy: null,
              failedAt: null,
              error: {
                message: error.message,
                code: error.code,
                retryCount,
              }
            }
          });
          results.retryPending++;
        } else {
          await db.generationJob.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
              lockedAt: null,
              lockedBy: null,
              error: {
                message: error.message,
                code: error.code,
                finalRetryCount: retryCount,
                reason: 'MAX_RETRIES_EXCEEDED',
              }
            }
          });
          results.failed++;
        }
      }
    }

    return results;
  }

  /**
   * Atomically claim a single eligible job using FOR UPDATE SKIP LOCKED.
   * Returns null if no eligible job exists.
   */
  private async claimNextJob(workerId: string) {
    // Raw SQL: claim a single QUEUED or RETRY_PENDING job atomically
    // The FOR UPDATE SKIP LOCKED prevents concurrent processors from double-claiming
    const claimedIds: { id: string }[] = await db.$queryRaw`
      UPDATE "GenerationJob"
      SET 
        status = 'CLAIMED',
        "lockedAt" = NOW(),
        "lockedBy" = ${workerId}
      WHERE id = (
        SELECT id FROM "GenerationJob"
        WHERE (status = 'QUEUED' OR status = 'RETRY_PENDING')
          AND ("scheduledAt" IS NULL OR "scheduledAt" <= NOW())
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING id;
    `;

    if (!claimedIds || claimedIds.length === 0) return null;

    return db.generationJob.findUnique({
      where: { id: claimedIds[0].id }
    });
  }

  /**
   * Recover stale CLAIMED/RUNNING jobs whose lock has expired.
   * Returns the count of recovered jobs.
   */
  private async recoverStaleJobs(): Promise<number> {
    const staleThreshold = new Date(Date.now() - JOB_LOCK_TIMEOUT_MS);

    const staleJobs = await db.generationJob.findMany({
      where: {
        status: { in: ['CLAIMED', 'RUNNING'] },
        lockedAt: { lt: staleThreshold }
      }
    });

    let recovered = 0;

    for (const job of staleJobs) {
      const retryCount = job.retryCount + 1;

      if (retryCount <= (job.maxRetries ?? MAX_RETRIES)) {
        // Return to RETRY_PENDING with a short delay for stale recovery
        await db.generationJob.update({
          where: { id: job.id },
          data: {
            status: 'RETRY_PENDING',
            lockedAt: null,
            lockedBy: null,
            retryCount,
            scheduledAt: new Date(Date.now() + 10000), // 10 second recovery delay
            error: {
              message: 'Job recovered from stale lock',
              staleSince: staleThreshold.toISOString(),
              workerId: job.lockedBy,
              retryCount,
            }
          }
        });
        recovered++;
      } else {
        await db.generationJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            lockedAt: null,
            lockedBy: null,
            error: {
              message: 'Job failed after repeated stale lock timeouts',
              finalRetryCount: retryCount,
              reason: 'MAX_RETRIES_EXCEEDED_VIA_STALE_RECOVERY',
            }
          }
        });
        // Count as recovered even if final-failed (removed from stuck state)
        recovered++;
      }
    }

    return recovered;
  }
}
