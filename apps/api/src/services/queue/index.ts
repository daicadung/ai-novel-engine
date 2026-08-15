import { IQueueManager } from './types.js';
import { BullQueueManager } from './BullQueueManager.js';
import { MemoryQueueManager } from './MemoryQueueManager.js';

export class QueueFactory {
  private static instance: IQueueManager | null = null;

  static getQueueManager(): IQueueManager {
    if (!this.instance) {
      if (process.env.NODE_ENV === 'test') {
        this.instance = new MemoryQueueManager();
      } else {
        this.instance = new BullQueueManager();
      }
    }
    return this.instance;
  }

  static setQueueManager(manager: IQueueManager) {
    this.instance = manager;
  }
}

export * from './types.js';
export * from './BullQueueManager.js';
export * from './MemoryQueueManager.js';
export * from './workerFactory.js';
