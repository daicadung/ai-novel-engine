import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';
export class MemoryService {
    async create(novelId, data) {
        return db.memory.create({ data: { ...data, novelId } });
    }
    async findAll(novelId) {
        return db.memory.findMany({ where: { novelId } });
    }
    async findById(id) {
        const item = await db.memory.findUnique({ where: { id } });
        if (!item)
            throw new NotFoundError('Memory not found');
        return item;
    }
    async update(id, data) {
        await this.findById(id);
        return db.memory.update({ where: { id }, data });
    }
    async delete(id) {
        await this.findById(id);
        return db.memory.delete({ where: { id } });
    }
}
export const memoryService = new MemoryService();
