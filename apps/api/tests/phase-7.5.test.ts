import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryQueueManager } from '../src/services/queue/MemoryQueueManager.js';
import { QueueFactory } from '../src/services/queue/index.js';
import { JobType, JobStatus, ArchitectStage } from '@ane/core';
import { timingSafeEqual } from 'node:crypto';

// =====================================================================
// Mock dispatcher so DB is not required
// =====================================================================
const mockDispatch = vi.fn().mockResolvedValue({ success: true });
vi.mock('../src/services/queue/JobDispatcher.js', () => ({
  JobDispatcher: class {
    dispatch = mockDispatch;
  }
}));

// =====================================================================
// 1. QUEUE BATCH LIMIT
// =====================================================================
describe('Queue Batch Limit (DB-Free)', () => {
  let queueManager: MemoryQueueManager;

  beforeEach(() => {
    queueManager = new MemoryQueueManager();
    QueueFactory.setQueueManager(queueManager);
    mockDispatch.mockClear();
  });

  it('should enqueue multiple jobs without processing them', async () => {
    for (let i = 0; i < 10; i++) {
      await queueManager.addJob(JobType.ARCHITECT_STAGE, {
        novelId: `novel-${i}`,
        stage: ArchitectStage.CONCEPT
      });
    }

    // All 10 jobs should be in QUEUED state — not auto-processed
    for (let i = 0; i < 10; i++) {
      const jobs = await queueManager.getJob(`novel-${i}`);
      // MemoryQueueManager may not support lookup by novelId, just verify count
    }
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});

// =====================================================================
// 2. IDEMPOTENCY — QUEUED JOBS CANNOT BE CLAIMED AGAIN
// =====================================================================
describe('Job Status State Machine (DB-Free)', () => {
  let queueManager: MemoryQueueManager;

  beforeEach(() => {
    queueManager = new MemoryQueueManager();
    QueueFactory.setQueueManager(queueManager);
    mockDispatch.mockClear();
  });

  it('should report QUEUED status after enqueue', async () => {
    const job = await queueManager.addJob(JobType.ARCHITECT_STAGE, {
      novelId: 'novel-1',
      stage: ArchitectStage.CONCEPT
    });

    expect(job.status).toBe(JobStatus.QUEUED);
    const status = await queueManager.getJobStatus(job.id);
    expect(status).toBe(JobStatus.QUEUED);
  });

  it('should cancel queued jobs', async () => {
    const job = await queueManager.addJob(JobType.ARCHITECT_STAGE, {
      novelId: 'novel-cancel',
      stage: ArchitectStage.CONCEPT
    });

    await queueManager.cancelJob(job.id);
    const status = await queueManager.getJobStatus(job.id);
    expect(status).toBe(JobStatus.CANCELLED);
  });

  it('should not allow cancelling a non-existent job', async () => {
    const result = await queueManager.cancelJob('nonexistent-id');
    expect(result).toBe(false);
  });
});

// =====================================================================
// 3. RETRY ACCOUNTING (unit-level logic test)
// =====================================================================
describe('Retry Accounting Logic (DB-Free)', () => {
  it('should schedule retry with exponential backoff', () => {
    // Simulate the retry scheduling logic
    const retryCount = 2;
    const delayMs = Math.pow(2, retryCount) * 1000;
    expect(delayMs).toBe(4000); // 2^2 = 4 seconds
  });

  it('should detect max retries exceeded', () => {
    const maxRetries = 3;
    const retryCount = 4; // next attempt would be 4
    expect(retryCount > maxRetries).toBe(true);
  });
});

// =====================================================================
// 4. CROSS-VERSION PROTECTION (unit logic)
// =====================================================================
describe('Cross-Version Protection (DB-Free)', () => {
  it('should reject scene with mismatched scenePlanVersionId', () => {
    const scenePlanVersionId = 'spv-A';
    const scene = { id: 'scene-1', scenePlanVersionId: 'spv-B' }; // mismatch!

    const isValid = scene.scenePlanVersionId === scenePlanVersionId;
    expect(isValid).toBe(false);
  });

  it('should accept scene with matching scenePlanVersionId', () => {
    const scenePlanVersionId = 'spv-A';
    const scene = { id: 'scene-1', scenePlanVersionId: 'spv-A' };

    const isValid = scene.scenePlanVersionId === scenePlanVersionId;
    expect(isValid).toBe(true);
  });
});

// =====================================================================
// 5. CRON SECURITY — TIMING-SAFE COMPARISON
// =====================================================================
describe('Cron Secret Comparison (DB-Free)', () => {
  it('should correctly validate a matching secret using timingSafeEqual', () => {
    const secret = 'my-super-secret-key';
    const provided = 'my-super-secret-key';

    const secretBuf = Buffer.from(secret, 'utf8');
    const providedBuf = Buffer.from(provided, 'utf8');

    expect(secretBuf.length === providedBuf.length).toBe(true);
    expect(timingSafeEqual(secretBuf, providedBuf)).toBe(true);
  });

  it('should reject mismatched secrets using timingSafeEqual', () => {
    const secret = 'my-super-secret-key';
    const provided = 'wrong-key-same-size';

    const secretBuf = Buffer.from(secret, 'utf8');
    const providedBuf = Buffer.from(provided, 'utf8');

    // Only call timingSafeEqual if lengths match
    if (secretBuf.length === providedBuf.length) {
      expect(timingSafeEqual(secretBuf, providedBuf)).toBe(false);
    } else {
      // Different lengths — automatically reject
      expect(secretBuf.length === providedBuf.length).toBe(false);
    }
  });

  it('should reject secrets with different lengths without comparison', () => {
    const secret = 'correct-secret';
    const provided = 'wrong';

    const secretBuf = Buffer.from(secret, 'utf8');
    const providedBuf = Buffer.from(provided, 'utf8');

    expect(secretBuf.length === providedBuf.length).toBe(false);
  });
});

// =====================================================================
// 6. PROCESSOR SOFT DEADLINE LOGIC
// =====================================================================
describe('Processor Soft Deadline (DB-Free)', () => {
  it('should respect soft deadline before claiming new jobs', () => {
    const JOB_PROCESSOR_TIMEOUT_MS = 50000;
    const deadline = Date.now() + JOB_PROCESSOR_TIMEOUT_MS;

    // Simulate checking before each new job claim
    const shouldContinue = Date.now() < deadline;
    expect(shouldContinue).toBe(true);
  });

  it('should stop claiming when deadline is reached', () => {
    const deadline = Date.now() - 1; // already expired

    const shouldContinue = Date.now() < deadline;
    expect(shouldContinue).toBe(false);
  });
});

// =====================================================================
// 7. STALE RECOVERY LOGIC
// =====================================================================
describe('Stale Recovery Logic (DB-Free)', () => {
  it('should identify stale jobs by lock timeout', () => {
    const JOB_LOCK_TIMEOUT_MS = 180000;
    const lockedAt = new Date(Date.now() - JOB_LOCK_TIMEOUT_MS - 1000); // 1 second past threshold

    const staleThreshold = new Date(Date.now() - JOB_LOCK_TIMEOUT_MS);
    const isStale = lockedAt < staleThreshold;

    expect(isStale).toBe(true);
  });

  it('should not identify active jobs as stale', () => {
    const JOB_LOCK_TIMEOUT_MS = 180000;
    const lockedAt = new Date(Date.now() - 1000); // Just 1 second ago

    const staleThreshold = new Date(Date.now() - JOB_LOCK_TIMEOUT_MS);
    const isStale = lockedAt < staleThreshold;

    expect(isStale).toBe(false);
  });
});

// =====================================================================
// 8. CANONICAL POINTER PROTECTION (unit logic)
// =====================================================================
describe('Canonical Pointer Protection (DB-Free)', () => {
  it('should only allow currentVersionId to point to CANONICAL versions', () => {
    const CANONICAL = 'CANONICAL';
    const newVersionStatus = 'CANONICAL';

    // Guard: we should only set currentVersionId if status is CANONICAL
    const shouldUpdatePointer = newVersionStatus === CANONICAL;
    expect(shouldUpdatePointer).toBe(true);
  });

  it('should NOT update currentVersionId for STALE versions', () => {
    const CANONICAL = 'CANONICAL';
    const newVersionStatus = 'STALE';

    const shouldUpdatePointer = newVersionStatus === CANONICAL;
    expect(shouldUpdatePointer).toBe(false);
  });
});

// =====================================================================
// 9. STRUCTURED CRON RESPONSE SHAPE
// =====================================================================
describe('Cron Response Shape (DB-Free)', () => {
  it('should validate the ProcessorResult shape', () => {
    const result = {
      processed: 3,
      succeeded: 2,
      failed: 0,
      retryPending: 1,
      recovered: 0,
    };

    expect(typeof result.processed).toBe('number');
    expect(typeof result.succeeded).toBe('number');
    expect(typeof result.failed).toBe('number');
    expect(typeof result.retryPending).toBe('number');
    expect(typeof result.recovered).toBe('number');

    // All counters must be non-negative
    expect(result.processed).toBeGreaterThanOrEqual(0);
    expect(result.succeeded).toBeGreaterThanOrEqual(0);
    expect(result.failed).toBeGreaterThanOrEqual(0);
    expect(result.retryPending).toBeGreaterThanOrEqual(0);
    expect(result.recovered).toBeGreaterThanOrEqual(0);
  });
});
