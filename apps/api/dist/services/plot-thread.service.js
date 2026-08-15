import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';
export class PlotThreadService {
    async create(novelId, data) {
        return db.plotThread.create({ data: { ...data, novelId } });
    }
    async findAll(novelId) {
        return db.plotThread.findMany({ where: { novelId } });
    }
    async findById(id) {
        const item = await db.plotThread.findUnique({ where: { id } });
        if (!item)
            throw new NotFoundError('PlotThread not found');
        return item;
    }
    async update(id, data) {
        await this.findById(id);
        return db.plotThread.update({ where: { id }, data });
    }
    async delete(id) {
        await this.findById(id);
        return db.plotThread.delete({ where: { id } });
    }
}
export const plotThreadService = new PlotThreadService();
