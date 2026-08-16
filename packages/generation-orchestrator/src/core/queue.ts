import { QueueAdapter } from '../types';

// ponytail: current ceiling in-memory queue only; upgrade path Redis-backed worker in production phase.
export class InMemoryQueueAdapter implements QueueAdapter {
  private queue: string[] = [];

  public async enqueue(jobId: string): Promise<void> {
    this.queue.push(jobId);
  }

  public async dequeue(): Promise<string | null> {
    const item = this.queue.shift();
    return item || null;
  }

  public async peek(): Promise<string | null> {
    if (this.queue.length === 0) return null;
    return this.queue[0];
  }

  public async size(): Promise<number> {
    return this.queue.length;
  }

  public async clear(): Promise<void> {
    this.queue = [];
  }
}
