import { describe, it, expect } from 'vitest';
import { GenerationOrchestrator } from '../core/orchestrator';
import { createJob, startJob } from '../core/state';

describe('GenerationOrchestrator', () => {
  const mockClock = () => new Date(1000);
  const mockIdFactory = () => 'job-1';

  it('runs next step successfully', async () => {
    const orchestrator = new GenerationOrchestrator(mockClock);
    orchestrator.registerHandler('concept_generation', async () => ({ concept: 'Hero' }));

    const job = startJob(createJob('nov-1', mockIdFactory, mockClock), mockClock);
    
    const nextJob = await orchestrator.runNext(job);
    
    expect(nextJob.steps[0].status).toBe('completed');
    expect(nextJob.checkpoints).toHaveLength(1);
    expect(nextJob.checkpoints[0].payload).toEqual({ concept: 'Hero' });
  });

  it('fails step if handler throws', async () => {
    const orchestrator = new GenerationOrchestrator(mockClock);
    orchestrator.registerHandler('concept_generation', async () => { throw new Error('Api fail') });

    const job = startJob(createJob('nov-1', mockIdFactory, mockClock), mockClock);
    
    const nextJob = await orchestrator.runNext(job);
    
    expect(nextJob.status).toBe('failed');
    expect(nextJob.steps[0].status).toBe('failed');
    expect(nextJob.failures).toHaveLength(1);
    expect(nextJob.failures[0].error_message).toBe('Api fail');
  });
});
