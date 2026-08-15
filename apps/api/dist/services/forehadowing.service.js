import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';
export class ForeshadowingService {
    async create(novelId, data) {
        return db.foreshadowing.create({ data: { ...data, novelId } });
    }
    async findAll(novelId) {
        return db.foreshadowing.findMany({ where: { novelId } });
    }
    async findById(id) {
        const item = await db.foreshadowing.findUnique({ where: { id } });
        if (!item)
            throw new NotFoundError('Foreshadowing not found');
        return item;
    }
    async update(id, data) {
        await this.findById(id);
        return db.foreshadowing.update({ where: { id }, data });
    }
    async delete(id) {
        await this.findById(id);
        return db.foreshadowing.delete({ where: { id } });
    }
}
export const foreshadowingService = new ForeshadowingService();
