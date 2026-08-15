import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';
export class RelationshipService {
    async create(novelId, data) {
        return db.relationship.create({ data: { ...data, novelId } });
    }
    async findAll(novelId) {
        return db.relationship.findMany({ where: { novelId } });
    }
    async findById(id) {
        const item = await db.relationship.findUnique({ where: { id } });
        if (!item)
            throw new NotFoundError('Relationship not found');
        return item;
    }
    async update(id, data) {
        await this.findById(id);
        return db.relationship.update({ where: { id }, data });
    }
    async delete(id) {
        await this.findById(id);
        return db.relationship.delete({ where: { id } });
    }
}
export const relationshipService = new RelationshipService();
