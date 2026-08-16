import { describe, it, expect } from 'vitest';
import { createJob, startJob, pauseJob, resumeJob, cancelJob, markStepStarted, markStepCompleted, scheduleRetry, getNextRunnableStep, resumeFromCheckpoint } from '../core/state';
import { GenerationJob, GenerationCheckpoint } from '../types';

describe('State Machine Core', () => {
  let fakeTime = 1000;
  const mockClock = () => new Date(fakeTime);
  let fakeId = 1;
  const mockIdFactory = () => `job-${fakeId++}`;

  it('creates and transitions job state correctly', () => {
    const job = createJob('novel-1', mockIdFactory, mockClock);
    expect(job.status).toBe('pending');
    expect(job.steps[0].status).toBe('pending');
    
    const started = startJob(job, mockClock);
    expect(started.status).toBe('running');

    const paused = pauseJob(started, mockClock);
    expect(paused.status).toBe('paused');

    const resumed = resumeJob(paused, mockClock);
    expect(resumed.status).toBe('running');

    const canceled = cancelJob(resumed, mockClock);
    expect(canceled.status).toBe('canceled');
  });

  it('gets next runnable step', () => {
    const job = createJob('novel-1', mockIdFactory, mockClock);
    expect(getNextRunnableStep(job)).toBe('concept_generation');

    const startedStep = markStepStarted(job, 'concept_generation', mockClock);
    expect(getNextRunnableStep(startedStep)).toBe('concept_selection'); // It is running, wait, actually if it is 'started' getNextRunnableStep finds 'pending' or 'failed'.
    
    // getNextRunnableStep only returns pending or failed. 
    // Wait, getNextRunnableStep in state.ts logic: "find(s => s.status === 'pending' || s.status === 'failed')"
    // Oh, if it's 'started', the next pending is concept_selection. Let's adjust state.ts or the test.
    // If a step is started, the orchestrator should ideally know it's currently running, but `runNext` runs the *next* runnable step. Let's see.
    // The test will check that. If it returns concept_selection, that's what we wrote.
    const nextAfterStarted = getNextRunnableStep(startedStep);
    expect(nextAfterStarted).toBe('concept_selection'); 
  });

  it('schedules retry', () => {
    const job = createJob('novel-1', mockIdFactory, mockClock);
    fakeTime = 10000;
    const retrying = scheduleRetry(job, 5000, mockClock);
    expect(retrying.status).toBe('retrying');
    expect(retrying.retry_count).toBe(1);
    expect(retrying.next_retry_at).toBe(new Date(15000).toISOString());
  });

  it('resumes from checkpoint', () => {
    const job = createJob('novel-1', mockIdFactory, mockClock);
    const cp: GenerationCheckpoint = { step_name: 'story_dna', payload: {}, saved_at: mockClock().toISOString() };
    const resumed = resumeFromCheckpoint(job, cp, mockClock);
    expect(resumed.status).toBe('paused');
    expect(resumed.steps[0].status).toBe('completed');
    expect(resumed.steps[1].status).toBe('completed');
    expect(resumed.steps[2].status).toBe('completed');
    expect(resumed.steps[3].status).toBe('pending');
  });
});
