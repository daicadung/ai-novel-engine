import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueueFactory, MemoryQueueManager, MemoryWorker } from '../src/services/queue/index.js';
import { JobType, JobStatus, ArchitectStage } from '@ane/core';

// Mock the dispatch method to avoid running real DB/LLM calls
const mockDispatch = vi.fn().mockResolvedValue(true);
vi.mock('../src/services/queue/JobDispatcher.js', () => {
  return {
    JobDispatcher: class {
      dispatch = mockDispatch;
    }
  };
});

describe('Queue System (DB-Free)', () => {
  let queueManager: MemoryQueueManager;
  let worker: MemoryWorker;

  beforeEach(() => {
    // Reset singleton state
    process.env.NODE_ENV = 'test';
    queueManager = new MemoryQueueManager();
    QueueFactory.setQueueManager(queueManager);
    worker = new MemoryWorker();
    mockDispatch.mockClear();
  });

  describe('Queue Abstraction', () => {
    it('should enqueue jobs successfully', async () => {
      const job = await queueManager.addJob(JobType.ARCHITECT_STAGE, {
        novelId: 'novel-1',
        stage: ArchitectStage.CONCEPT
      });

      expect(job.id).toBeDefined();
      expect(job.status).toBe(JobStatus.QUEUED);

      const fetched = await queueManager.getJob(job.id);
      expect(fetched).toMatchObject(job);
    });

    it('should pause and resume queue', async () => {
      await queueManager.pauseQueue();
      const job = await queueManager.addJob(JobType.ARCHITECT_STAGE, {
        novelId: 'novel-1',
        stage: ArchitectStage.CONCEPT
      });
      expect(job.status).toBe(JobStatus.PAUSED);

      await queueManager.resumeQueue();
      // Implementation-specific behavior: new jobs are queued
      const job2 = await queueManager.addJob(JobType.ARCHITECT_STAGE, {
        novelId: 'novel-1',
        stage: ArchitectStage.PREMISE
      });
      expect(job2.status).toBe(JobStatus.QUEUED);
    });

    it('should cancel queued jobs', async () => {
      const job = await queueManager.addJob(JobType.ARCHITECT_STAGE, {
        novelId: 'novel-1',
        stage: ArchitectStage.CONCEPT
      });
      const success = await queueManager.cancelJob(job.id);
      expect(success).toBe(true);

      const status = await queueManager.getJobStatus(job.id);
      expect(status).toBe(JobStatus.CANCELLED);
    });
  });

  describe('Worker Execution', () => {
    it('should process jobs through the dispatcher', async () => {
      const job = await queueManager.addJob(JobType.ARCHITECT_STAGE, {
        novelId: 'novel-1',
        stage: ArchitectStage.CONCEPT
      });

      // Synchronously drain queue for testing
      await worker.drainQueue();

      expect(mockDispatch).toHaveBeenCalledTimes(1);
      expect(mockDispatch).toHaveBeenCalledWith(
        JobType.ARCHITECT_STAGE,
        expect.objectContaining({ novelId: 'novel-1' })
      );

      const status = await queueManager.getJobStatus(job.id);
      expect(status).toBe(JobStatus.COMPLETED);
    });

    it('should mark jobs as FAILED if dispatcher throws', async () => {
      mockDispatch.mockRejectedValueOnce(new Error('Simulated failure'));

      const job = await queueManager.addJob(JobType.ARCHITECT_STAGE, {
        novelId: 'novel-error',
        stage: ArchitectStage.CONCEPT
      });

      await worker.drainQueue();

      const status = await queueManager.getJobStatus(job.id);
      expect(status).toBe(JobStatus.FAILED);
    });
  });
});
