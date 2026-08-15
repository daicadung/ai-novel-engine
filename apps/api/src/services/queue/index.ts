import { IQueueManager } from './types.js';
import { DatabaseQueueManager } from './DatabaseQueueManager.js';
import { MemoryQueueManager } from './MemoryQueueManager.js';

export class QueueFactory {
  private static instance: IQueueManager | null = null;

  static getQueueManager(): IQueueManager {
    if (!this.instance) {
      if (process.env.NODE_ENV === 'test') {
        this.instance = new MemoryQueueManager();
      } else {
        this.instance = new DatabaseQueueManager();
      }
    }
    return this.instance;
  }

  static setQueueManager(manager: IQueueManager) {
    this.instance = manager;
  }
}

export * from './types.js';
export * from './DatabaseQueueManager.js';
export * from './MemoryQueueManager.js';
export * from './MemoryWorker.js';
