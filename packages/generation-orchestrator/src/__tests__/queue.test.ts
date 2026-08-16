import { describe, it, expect } from 'vitest';
import { InMemoryQueueAdapter } from '../core/queue';

describe('InMemoryQueueAdapter', () => {
  it('enqueues and dequeues FIFO', async () => {
    const queue = new InMemoryQueueAdapter();
    await queue.enqueue('job-1');
    await queue.enqueue('job-2');

    expect(await queue.size()).toBe(2);
    expect(await queue.peek()).toBe('job-1');
    
    expect(await queue.dequeue()).toBe('job-1');
    expect(await queue.dequeue()).toBe('job-2');
    expect(await queue.dequeue()).toBeNull();
  });

  it('clears queue', async () => {
    const queue = new InMemoryQueueAdapter();
    await queue.enqueue('job-1');
    await queue.clear();
    expect(await queue.size()).toBe(0);
  });
});
