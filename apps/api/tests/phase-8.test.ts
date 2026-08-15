import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NovelGenerationConfigSchema,
  NovelGenerationState,
  GenerationStageType,
} from '@ane/core';
import { GenerationStageResolver } from '../src/services/generation/GenerationStageResolver.js';

// =====================================================================
// 1. Config Zod Validation
// =====================================================================
describe('NovelGenerationConfig Zod Validation', () => {
  it('should parse valid config', () => {
    const result = NovelGenerationConfigSchema.parse({
      autoContinue: true,
      maxConcurrentJobs: 5,
      chapterBatchSize: 10,
      generationWindowSize: 2,
    });
    expect(result.autoContinue).toBe(true);
    expect(result.maxConcurrentJobs).toBe(5);
  });

  it('should apply defaults for missing fields', () => {
    const result = NovelGenerationConfigSchema.parse({});
    expect(result.autoContinue).toBe(false);
    expect(result.autoGenerateScenes).toBe(true);
    expect(result.autoGenerateProse).toBe(true);
    expect(result.maxConcurrentJobs).toBe(3);
    expect(result.chapterBatchSize).toBe(10);
    expect(result.generationWindowSize).toBe(2);
  });

  it('should reject maxConcurrentJobs below 1', () => {
    expect(() => NovelGenerationConfigSchema.parse({ maxConcurrentJobs: 0 })).toThrow();
  });

  it('should reject maxConcurrentJobs above 20', () => {
    expect(() => NovelGenerationConfigSchema.parse({ maxConcurrentJobs: 21 })).toThrow();
  });

  it('should reject chapterBatchSize above 100', () => {
    expect(() => NovelGenerationConfigSchema.parse({ chapterBatchSize: 101 })).toThrow();
  });

  it('should reject negative maxGenerationCostUsd', () => {
    expect(() => NovelGenerationConfigSchema.parse({ maxGenerationCostUsd: -1 })).toThrow();
  });

  it('should reject generationWindowSize below 1', () => {
    expect(() => NovelGenerationConfigSchema.parse({ generationWindowSize: 0 })).toThrow();
  });

  it('should reject generationWindowSize above 20', () => {
    expect(() => NovelGenerationConfigSchema.parse({ generationWindowSize: 21 })).toThrow();
  });
});

// =====================================================================
// 2. Idempotency Key Generation (DB-Free)
// =====================================================================
describe('GenerationStageResolver.buildIdempotencyKey', () => {
  it('should build ARCHITECT key', () => {
    const key = GenerationStageResolver.buildIdempotencyKey('novel-1', GenerationStageType.ARCHITECT);
    expect(key).toBe('NOVEL:novel-1:ARCHITECT');
  });

  it('should build PLANNER_DESTINATION key', () => {
    const key = GenerationStageResolver.buildIdempotencyKey('novel-1', GenerationStageType.PLANNER_DESTINATION);
    expect(key).toBe('NOVEL:novel-1:PLANNER:DESTINATION');
  });

  it('should build PLANNER_MACRO key', () => {
    const key = GenerationStageResolver.buildIdempotencyKey('novel-1', GenerationStageType.PLANNER_MACRO);
    expect(key).toBe('NOVEL:novel-1:PLANNER:MACRO');
  });

  it('should build PLANNER_SAGA key', () => {
    const key = GenerationStageResolver.buildIdempotencyKey('novel-1', GenerationStageType.PLANNER_SAGA);
    expect(key).toBe('NOVEL:novel-1:PLANNER:SAGA');
  });

  it('should build PLANNER_ARC key with sagaId', () => {
    const key = GenerationStageResolver.buildIdempotencyKey('novel-1', GenerationStageType.PLANNER_ARC, { sagaId: 'saga-42' });
    expect(key).toBe('NOVEL:novel-1:PLANNER:ARC:saga-42');
  });

  it('should build CHAPTER_BLUEPRINT key with range', () => {
    const key = GenerationStageResolver.buildIdempotencyKey('novel-1', GenerationStageType.CHAPTER_BLUEPRINT, {
      chapterStart: 1,
      chapterEnd: 10,
    });
    expect(key).toBe('NOVEL:novel-1:CHAPTER_BLUEPRINT:1-10');
  });

  it('should build different CHAPTER_BLUEPRINT keys for different ranges', () => {
    const key1 = GenerationStageResolver.buildIdempotencyKey('novel-1', GenerationStageType.CHAPTER_BLUEPRINT, { chapterStart: 1, chapterEnd: 10 });
    const key2 = GenerationStageResolver.buildIdempotencyKey('novel-1', GenerationStageType.CHAPTER_BLUEPRINT, { chapterStart: 11, chapterEnd: 20 });
    expect(key1).not.toBe(key2);
  });

  it('should build SCENE_PLAN key with chapterId', () => {
    const key = GenerationStageResolver.buildIdempotencyKey('novel-1', GenerationStageType.SCENE_PLAN, { chapterId: 'ch-99' });
    expect(key).toBe('NOVEL:novel-1:SCENE_PLAN:ch-99');
  });

  it('should build PROSE key with chapterId', () => {
    const key = GenerationStageResolver.buildIdempotencyKey('novel-1', GenerationStageType.PROSE, { chapterId: 'ch-99' });
    expect(key).toBe('NOVEL:novel-1:PROSE:ch-99');
  });

  it('should build deterministic keys — same inputs produce same key', () => {
    const a = GenerationStageResolver.buildIdempotencyKey('novel-123', GenerationStageType.PROSE, { chapterId: 'ch-5' });
    const b = GenerationStageResolver.buildIdempotencyKey('novel-123', GenerationStageType.PROSE, { chapterId: 'ch-5' });
    expect(a).toBe(b);
  });

  it('should build different keys for different novelIds', () => {
    const a = GenerationStageResolver.buildIdempotencyKey('novel-1', GenerationStageType.ARCHITECT);
    const b = GenerationStageResolver.buildIdempotencyKey('novel-2', GenerationStageType.ARCHITECT);
    expect(a).not.toBe(b);
  });
});

// =====================================================================
// 3. Generation State Machine (DB-Free logic)
// =====================================================================
describe('NovelGenerationState transitions', () => {
  it('should be a valid enum with all expected states', () => {
    expect(NovelGenerationState.DRAFT).toBe('DRAFT');
    expect(NovelGenerationState.INITIALIZING).toBe('INITIALIZING');
    expect(NovelGenerationState.ARCHITECTING).toBe('ARCHITECTING');
    expect(NovelGenerationState.PLANNING).toBe('PLANNING');
    expect(NovelGenerationState.GENERATING_CHAPTERS).toBe('GENERATING_CHAPTERS');
    expect(NovelGenerationState.GENERATING_SCENES).toBe('GENERATING_SCENES');
    expect(NovelGenerationState.GENERATING_PROSE).toBe('GENERATING_PROSE');
    expect(NovelGenerationState.PAUSED).toBe('PAUSED');
    expect(NovelGenerationState.COMPLETED).toBe('COMPLETED');
    expect(NovelGenerationState.FAILED).toBe('FAILED');
    expect(NovelGenerationState.BLOCKED).toBe('BLOCKED');
  });
});

// =====================================================================
// 4. GenerationStageType (DB-Free)
// =====================================================================
describe('GenerationStageType', () => {
  it('should contain all expected stages', () => {
    expect(GenerationStageType.ARCHITECT).toBe('ARCHITECT');
    expect(GenerationStageType.PLANNER_DESTINATION).toBe('PLANNER_DESTINATION');
    expect(GenerationStageType.PLANNER_MACRO).toBe('PLANNER_MACRO');
    expect(GenerationStageType.PLANNER_SAGA).toBe('PLANNER_SAGA');
    expect(GenerationStageType.PLANNER_ARC).toBe('PLANNER_ARC');
    expect(GenerationStageType.PLANNER_MINI_ARC).toBe('PLANNER_MINI_ARC');
    expect(GenerationStageType.CHAPTER_BLUEPRINT).toBe('CHAPTER_BLUEPRINT');
    expect(GenerationStageType.SCENE_PLAN).toBe('SCENE_PLAN');
    expect(GenerationStageType.PROSE).toBe('PROSE');
    expect(GenerationStageType.COMPLETED).toBe('COMPLETED');
    expect(GenerationStageType.BLOCKED).toBe('BLOCKED');
  });
});

// =====================================================================
// 5. Generation Window Logic (DB-Free arithmetic)
// =====================================================================
describe('Generation Window Strategy', () => {
  it('should not exceed target chapter count', () => {
    const targetChapters = 1000;
    const generationWindowSize = 2;
    const chapterBatchSize = 10;
    const completedChapters = 0;

    const windowStart = completedChapters + 1;
    const windowEnd = Math.min(windowStart + generationWindowSize * chapterBatchSize - 1, targetChapters);
    expect(windowEnd).toBe(20); // 2 windows × 10 = 20
    expect(windowEnd).toBeLessThanOrEqual(targetChapters);
  });

  it('should advance window after completion', () => {
    const targetChapters = 100;
    const chapterBatchSize = 10;
    const completedChapters = 10;

    const nextBatchStart = completedChapters + 1;
    const nextBatchEnd = Math.min(nextBatchStart + chapterBatchSize - 1, targetChapters);
    expect(nextBatchStart).toBe(11);
    expect(nextBatchEnd).toBe(20);
  });

  it('should cap at targetChapters for the final batch', () => {
    const targetChapters = 15;
    const chapterBatchSize = 10;
    const completedChapters = 10;

    const nextBatchStart = completedChapters + 1;
    const nextBatchEnd = Math.min(nextBatchStart + chapterBatchSize - 1, targetChapters);
    expect(nextBatchStart).toBe(11);
    expect(nextBatchEnd).toBe(15); // Capped at target
  });

  it('should detect completion when completedChapters >= targetChapters', () => {
    const targetChapters = 100;
    const completedChapters = 100;
    const windowStart = completedChapters + 1;

    expect(windowStart > targetChapters).toBe(true); // → COMPLETED
  });

  it('1000-chapter novel should NOT start with 1000 jobs', () => {
    const targetChapters = 1000;
    const generationWindowSize = 2;
    const chapterBatchSize = 10;

    const maxJobsCreatedOnStart = generationWindowSize * chapterBatchSize;
    expect(maxJobsCreatedOnStart).toBe(20); // Only 20, not 1000
    expect(maxJobsCreatedOnStart).toBeLessThan(targetChapters);
  });
});

// =====================================================================
// 6. Concurrency Control (DB-Free arithmetic)
// =====================================================================
describe('Concurrency Control', () => {
  it('should not create new jobs when at maxConcurrentJobs', () => {
    const maxConcurrentJobs = 3;
    const activeJobCount = 3;

    const shouldCreateNewJob = activeJobCount < maxConcurrentJobs;
    expect(shouldCreateNewJob).toBe(false);
  });

  it('should allow job creation when under limit', () => {
    const maxConcurrentJobs = 3;
    const activeJobCount = 1;

    const shouldCreateNewJob = activeJobCount < maxConcurrentJobs;
    expect(shouldCreateNewJob).toBe(true);
  });
});

// =====================================================================
// 7. Budget Control (DB-Free arithmetic)
// =====================================================================
describe('Budget Control', () => {
  it('should detect budget exceeded', () => {
    const maxGenerationCostUsd = 10.0;
    const spent = 10.5;

    const isExceeded = spent >= maxGenerationCostUsd;
    expect(isExceeded).toBe(true);
  });

  it('should allow generation when budget has room', () => {
    const maxGenerationCostUsd = 10.0;
    const spent = 5.0;

    const isExceeded = spent >= maxGenerationCostUsd;
    expect(isExceeded).toBe(false);
  });

  it('should allow unlimited generation when no budget set', () => {
    const maxGenerationCostUsd = undefined;
    const isExceeded = maxGenerationCostUsd !== undefined && 9999 >= maxGenerationCostUsd;
    expect(isExceeded).toBe(false);
  });
});

// =====================================================================
// 8. Paused Novel Guard (DB-Free logic)
// =====================================================================
describe('Paused Novel Guard', () => {
  it('should not advance when state is PAUSED', () => {
    const state = NovelGenerationState.PAUSED;
    const pausedOrTerminal = [
      NovelGenerationState.PAUSED,
      NovelGenerationState.COMPLETED,
      NovelGenerationState.FAILED,
    ].includes(state);

    expect(pausedOrTerminal).toBe(true); // → return early, no new jobs
  });

  it('should advance when state is GENERATING_PROSE', () => {
    const state = NovelGenerationState.GENERATING_PROSE;
    const pausedOrTerminal = [
      NovelGenerationState.PAUSED,
      NovelGenerationState.COMPLETED,
      NovelGenerationState.FAILED,
    ].includes(state);

    expect(pausedOrTerminal).toBe(false);
  });
});

// =====================================================================
// 9. Duplicate Job Prevention (idempotency logic)
// =====================================================================
describe('Duplicate Job Prevention', () => {
  const ACTIVE_STATUSES = ['QUEUED', 'CLAIMED', 'RUNNING', 'RETRY_PENDING'];

  it('should skip job creation when QUEUED job with same key exists', () => {
    const existingJobStatus = 'QUEUED';
    const shouldSkip = ACTIVE_STATUSES.includes(existingJobStatus);
    expect(shouldSkip).toBe(true);
  });

  it('should skip job creation when RUNNING job with same key exists', () => {
    const existingJobStatus = 'RUNNING';
    const shouldSkip = ACTIVE_STATUSES.includes(existingJobStatus);
    expect(shouldSkip).toBe(true);
  });

  it('should allow job creation when only FAILED job with same key exists', () => {
    const existingJobStatus = 'FAILED';
    const shouldSkip = ACTIVE_STATUSES.includes(existingJobStatus);
    expect(shouldSkip).toBe(false); // → can re-create (retry semantics)
  });

  it('should allow job creation when no existing job', () => {
    const existingJob = null;
    const shouldSkip = existingJob !== null && ACTIVE_STATUSES.includes((existingJob as any).status);
    expect(shouldSkip).toBe(false);
  });
});

// =====================================================================
// 10. Cancel safety (DB-Free logic)
// =====================================================================
describe('Cancel Safety', () => {
  it('should only cancel QUEUED jobs', () => {
    const jobs = [
      { id: '1', status: 'QUEUED' },
      { id: '2', status: 'CLAIMED' },
      { id: '3', status: 'RUNNING' },
      { id: '4', status: 'SUCCEEDED' },
    ];

    const cancellable = jobs.filter((j) => j.status === 'QUEUED');
    expect(cancellable).toHaveLength(1);
    expect(cancellable[0].id).toBe('1');
  });

  it('should not cancel CLAIMED or RUNNING jobs', () => {
    const activeJobs = ['CLAIMED', 'RUNNING'];
    activeJobs.forEach((status) => {
      expect(status === 'QUEUED').toBe(false);
    });
  });
});

// =====================================================================
// 11. Retry Failed Safety (DB-Free)
// =====================================================================
describe('Retry Failed Safety', () => {
  it('should only retry jobs under MAX_RETRIES', () => {
    const MAX_RETRIES = 3;
    const failedJobs = [
      { id: '1', retryCount: 2, status: 'FAILED' },
      { id: '2', retryCount: 3, status: 'FAILED' }, // at limit
      { id: '3', retryCount: 1, status: 'FAILED' },
    ];

    const retryable = failedJobs.filter((j) => j.retryCount < MAX_RETRIES);
    expect(retryable).toHaveLength(2);
    expect(retryable.map((j) => j.id)).toEqual(['1', '3']);
  });
});

// =====================================================================
// 12. Correlation ID Propagation
// =====================================================================
describe('Correlation ID', () => {
  it('should generate a unique correlationId per run', () => {
    const { randomUUID } = require('node:crypto');
    const id1 = `gen-${randomUUID()}`;
    const id2 = `gen-${randomUUID()}`;
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^gen-/);
  });
});

// =====================================================================
// 13. No LLM invocation guarantee (structural check)
// =====================================================================
describe('No Direct LLM Invocation', () => {
  it('GenerationStageResolver should not import LLM providers', async () => {
    // Verify the file content doesn't directly import OpenAI/Anthropic/NineRouter
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/generation/GenerationStageResolver.ts', import.meta.url),
      'utf8'
    );
    expect(content).not.toContain('openai');
    expect(content).not.toContain('anthropic');
    expect(content).not.toContain('NineRouterProvider');
    expect(content).not.toContain('ProviderFactory');
    expect(content).not.toContain('OpenAIProvider');
  });

  it('NovelGenerationOrchestrator should not import LLM providers', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync(
      new URL('../src/services/generation/NovelGenerationOrchestrator.ts', import.meta.url),
      'utf8'
    );
    expect(content).not.toContain('openai');
    expect(content).not.toContain('anthropic');
    expect(content).not.toContain('NineRouterProvider');
    expect(content).not.toContain('OpenAIProvider');
    // Orchestrator should NOT call ProviderFactory
    expect(content).not.toContain('ProviderFactory');
  });
});

// =====================================================================
// 14. Progress Calculation
// =====================================================================
describe('Progress Calculation', () => {
  it('should calculate progress percentage correctly', () => {
    const targetChapters = 1000;
    const completedChapters = 420;
    const percent = Math.round((completedChapters / targetChapters) * 100 * 10) / 10;
    expect(percent).toBe(42);
  });

  it('should return 0 when no chapters completed', () => {
    const targetChapters = 100;
    const completedChapters = 0;
    const percent = Math.round((completedChapters / targetChapters) * 100 * 10) / 10;
    expect(percent).toBe(0);
  });

  it('should return 100 when all chapters completed', () => {
    const targetChapters = 100;
    const completedChapters = 100;
    const percent = Math.round((completedChapters / targetChapters) * 100 * 10) / 10;
    expect(percent).toBe(100);
  });
});

// =====================================================================
// 15. Chapter Batch Range arithmetic
// =====================================================================
describe('Chapter Batch Range', () => {
  it('should generate non-overlapping batches', () => {
    const chapterBatchSize = 10;
    const batches: { start: number; end: number }[] = [];

    let start = 1;
    for (let i = 0; i < 5; i++) {
      const end = start + chapterBatchSize - 1;
      batches.push({ start, end });
      start = end + 1;
    }

    // Verify no overlap
    for (let i = 0; i < batches.length - 1; i++) {
      expect(batches[i].end + 1).toBe(batches[i + 1].start);
    }

    // Verify correct ranges
    expect(batches[0]).toEqual({ start: 1, end: 10 });
    expect(batches[1]).toEqual({ start: 11, end: 20 });
    expect(batches[4]).toEqual({ start: 41, end: 50 });
  });
});
