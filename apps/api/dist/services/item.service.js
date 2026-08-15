import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';
export class ItemService {
    async create(novelId, data) {
        return db.item.create({ data: { ...data, novelId } });
    }
    async findAll(novelId) {
        return db.item.findMany({ where: { novelId } });
    }
    async findById(id) {
        const item = await db.item.findUnique({ where: { id } });
        if (!item)
            throw new NotFoundError('Item not found');
        return item;
    }
    async update(id, data) {
        await this.findById(id);
        return db.item.update({ where: { id }, data });
    }
    async delete(id) {
        await this.findById(id);
        return db.item.delete({ where: { id } });
    }
}
export const itemService = new ItemService();
