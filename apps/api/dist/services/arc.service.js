import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';
export class ArcService {
    async create(novelId, data) {
        return db.arc.create({ data: { ...data, novelId } });
    }
    async findAll(novelId) {
        return db.arc.findMany({ where: { novelId } });
    }
    async findById(id) {
        const item = await db.arc.findUnique({ where: { id } });
        if (!item)
            throw new NotFoundError('Arc not found');
        return item;
    }
    async update(id, data) {
        await this.findById(id);
        return db.arc.update({ where: { id }, data });
    }
    async delete(id) {
        await this.findById(id);
        return db.arc.delete({ where: { id } });
    }
}
export const arcService = new ArcService();
