import { IWorker } from './types.js';
import { BullWorker } from './BullWorker.js';
import { MemoryWorker } from './MemoryWorker.js';

export class WorkerFactory {
  private static instance: IWorker | null = null;

  static getWorker(): IWorker {
    if (!this.instance) {
      if (process.env.NODE_ENV === 'test') {
        this.instance = new MemoryWorker();
      } else {
        this.instance = new BullWorker();
      }
    }
    return this.instance;
  }

  static setWorker(worker: IWorker) {
    this.instance = worker;
  }
}

export * from './BullWorker.js';
export * from './MemoryWorker.js';
