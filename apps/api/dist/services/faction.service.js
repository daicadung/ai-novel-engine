import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';
export class FactionService {
    async create(novelId, data) {
        return db.faction.create({ data: { ...data, novelId } });
    }
    async findAll(novelId) {
        return db.faction.findMany({ where: { novelId } });
    }
    async findById(id) {
        const item = await db.faction.findUnique({ where: { id } });
        if (!item)
            throw new NotFoundError('Faction not found');
        return item;
    }
    async update(id, data) {
        await this.findById(id);
        return db.faction.update({ where: { id }, data });
    }
    async delete(id) {
        await this.findById(id);
        return db.faction.delete({ where: { id } });
    }
}
export const factionService = new FactionService();
