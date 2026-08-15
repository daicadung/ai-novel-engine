import { BullWorker } from './BullWorker.js';
import { MemoryWorker } from './MemoryWorker.js';
export class WorkerFactory {
    static instance = null;
    static getWorker() {
        if (!this.instance) {
            if (process.env.NODE_ENV === 'test') {
                this.instance = new MemoryWorker();
            }
            else {
                this.instance = new BullWorker();
            }
        }
        return this.instance;
    }
    static setWorker(worker) {
        this.instance = worker;
    }
}
export * from './BullWorker.js';
export * from './MemoryWorker.js';
