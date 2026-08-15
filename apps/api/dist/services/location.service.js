import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';
export class LocationService {
    async create(novelId, data) {
        return db.location.create({ data: { ...data, novelId } });
    }
    async findAll(novelId) {
        return db.location.findMany({ where: { novelId } });
    }
    async findById(id) {
        const item = await db.location.findUnique({ where: { id } });
        if (!item)
            throw new NotFoundError('Location not found');
        return item;
    }
    async update(id, data) {
        await this.findById(id);
        return db.location.update({ where: { id }, data });
    }
    async delete(id) {
        await this.findById(id);
        return db.location.delete({ where: { id } });
    }
}
export const locationService = new LocationService();
