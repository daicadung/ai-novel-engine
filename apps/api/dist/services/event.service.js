import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';
export class EventService {
    async create(novelId, data) {
        return db.event.create({ data: { ...data, novelId } });
    }
    async findAll(novelId) {
        return db.event.findMany({ where: { novelId } });
    }
    async findById(id) {
        const item = await db.event.findUnique({ where: { id } });
        if (!item)
            throw new NotFoundError('Event not found');
        return item;
    }
    async update(id, data) {
        await this.findById(id);
        return db.event.update({ where: { id }, data });
    }
    async delete(id) {
        await this.findById(id);
        return db.event.delete({ where: { id } });
    }
}
export const eventService = new EventService();
