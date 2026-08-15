import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';
export class NovelService {
    async create(data) {
        return db.novel.create({ data });
    }
    async findAll() {
        return db.novel.findMany({ orderBy: { updatedAt: 'desc' } });
    }
    async findById(id) {
        const novel = await db.novel.findUnique({ where: { id } });
        if (!novel)
            throw new NotFoundError('Novel not found');
        return novel;
    }
    async update(id, data) {
        await this.findById(id);
        return db.novel.update({ where: { id }, data });
    }
    async delete(id) {
        await this.findById(id);
        return db.novel.delete({ where: { id } });
    }
}
export const novelService = new NovelService();
