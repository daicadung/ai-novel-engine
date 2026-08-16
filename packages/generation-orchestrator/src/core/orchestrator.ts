import { GenerationJob, PipelineStepName } from '../types';
import { getNextRunnableStep, markStepStarted, markStepCompleted, markStepFailed } from './state';

export type StepHandler = (job: GenerationJob) => Promise<Record<string, unknown>>;

export class GenerationOrchestrator {
  private handlers: Partial<Record<PipelineStepName, StepHandler>> = {};

  constructor(private readonly clock: () => Date) {}

  public registerHandler(step: PipelineStepName, handler: StepHandler): void {
    this.handlers[step] = handler;
  }

  public async runNext(job: GenerationJob): Promise<GenerationJob> {
    if (job.status !== 'running' && job.status !== 'retrying' && job.status !== 'pending') {
      return job; // invalid state to run
    }

    const nextStepName = getNextRunnableStep(job);
    if (!nextStepName) {
      return job;
    }

    const handler = this.handlers[nextStepName];
    if (!handler) {
      return markStepFailed(job, nextStepName, `No handler registered for step: ${nextStepName}`, false, this.clock);
    }

    let runningJob = markStepStarted(job, nextStepName, this.clock);

    try {
      const payload = await handler(runningJob);
      return markStepCompleted(runningJob, nextStepName, payload, this.clock);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return markStepFailed(runningJob, nextStepName, msg, true, this.clock);
    }
  }
}
