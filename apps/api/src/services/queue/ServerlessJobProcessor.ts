import { db } from '@ane/database';
import { JobDispatcher } from './JobDispatcher.js';
import { JobType } from '@ane/core';

const JOB_LOCK_TIMEOUT_MS = parseInt(process.env.JOB_LOCK_TIMEOUT_SECONDS || '300', 10) * 1000;

export class ServerlessJobProcessor {
  private dispatcher = new JobDispatcher();

  async processNextBatch(maxJobs: number = parseInt(process.env.MAX_JOBS_PER_RUN || '5', 10)) {
    const workerId = `worker-${Math.random().toString(36).substring(7)}-${Date.now()}`;
    
    // 1. Recover stale jobs
    await this.recoverStaleJobs();

    // 2. Claim jobs
    const jobs = await this.claimJobs(maxJobs, workerId);
    
    const results = {
      processed: 0,
      completed: 0,
      failed: 0,
      retried: 0,
    };

    // 3. Process jobs
    for (const job of jobs) {
      results.processed++;
      try {
        await db.generationJob.update({
          where: { id: job.id },
          data: { status: 'RUNNING', startedAt: new Date() }
        });

        // Map type
        const payload = job.input as any;
        let type = JobType.PROSE_GENERATION;
        if (job.stage) type = JobType.ARCHITECT_STAGE;
        else if (job.plannerStage) type = JobType.PLANNER_STAGE;
        else if (job.sceneStage) type = JobType.SCENE_GENERATION;
        else if (job.proseStage) type = JobType.PROSE_GENERATION;
        else if (payload && payload.type && Object.values(JobType).includes(payload.type)) {
          type = payload.type;
        } else if (payload && payload.stage) {
          if (Object.values(JobType).includes(payload.type)) type = payload.type;
        }

        const result = await this.dispatcher.dispatch(type, payload);

        await db.generationJob.update({
          where: { id: job.id },
          data: {
            status: 'SUCCEEDED',
            output: result || {},
            completedAt: new Date(),
          }
        });
        results.completed++;
      } catch (error: any) {
        // Handle failure and retries
        const retryCount = job.retryCount + 1;
        if (retryCount <= job.maxRetries) {
          // Retry
          const delayMs = Math.pow(2, retryCount) * 1000; // Exponential backoff
          await db.generationJob.update({
            where: { id: job.id },
            data: {
              status: 'RETRY_PENDING',
              retryCount,
              scheduledAt: new Date(Date.now() + delayMs),
              lockedAt: null,
              lockedBy: null,
              error: { message: error.message, stack: error.stack }
            }
          });
          results.retried++;
        } else {
          // Fail completely
          await db.generationJob.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
              error: { message: error.message, stack: error.stack }
            }
          });
          results.failed++;
        }
      }
    }

    return results;
  }

  private async claimJobs(limit: number, workerId: string) {
    // Atomic claiming using raw SQL to ensure FOR UPDATE SKIP LOCKED
    // We update up to 'limit' jobs that are QUEUED or RETRY_PENDING and have no future scheduledAt
    // Prisma doesn't have a native UPDATE ... LIMIT, so we use executeRaw or similar.
    
    const claimedJobIds: { id: string }[] = await db.$queryRaw`
      UPDATE "GenerationJob"
      SET 
        status = 'CLAIMED',
        "lockedAt" = NOW(),
        "lockedBy" = ${workerId}
      WHERE id IN (
        SELECT id FROM "GenerationJob"
        WHERE (status = 'QUEUED' OR status = 'RETRY_PENDING')
          AND ("scheduledAt" IS NULL OR "scheduledAt" <= NOW())
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      RETURNING id;
    `;

    if (!claimedJobIds || claimedJobIds.length === 0) {
      return [];
    }

    const ids = claimedJobIds.map(j => j.id);

    return db.generationJob.findMany({
      where: { id: { in: ids } }
    });
  }

  private async recoverStaleJobs() {
    const staleThreshold = new Date(Date.now() - JOB_LOCK_TIMEOUT_MS);
    
    // Find stale jobs
    const staleJobs = await db.generationJob.findMany({
      where: {
        status: { in: ['CLAIMED', 'RUNNING'] },
        lockedAt: { lt: staleThreshold }
      }
    });

    for (const job of staleJobs) {
      const retryCount = job.retryCount + 1;
      if (retryCount <= job.maxRetries) {
        await db.generationJob.update({
          where: { id: job.id },
          data: {
            status: 'RETRY_PENDING',
            lockedAt: null,
            lockedBy: null,
            retryCount,
            scheduledAt: new Date(Date.now() + 5000), // Quick retry for stale recovery
            error: { message: 'Job recovered from stale lock timeout' }
          }
        });
      } else {
        await db.generationJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            error: { message: 'Job failed completely due to repeated stale lock timeouts' }
          }
        });
      }
    }
  }
}
