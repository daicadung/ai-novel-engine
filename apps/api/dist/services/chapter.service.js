import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';
export class ChapterService {
    async create(novelId, data) {
        return db.chapter.create({ data: { ...data, novelId } });
    }
    async findAll(novelId) {
        return db.chapter.findMany({ where: { novelId } });
    }
    async findById(id) {
        const item = await db.chapter.findUnique({ where: { id } });
        if (!item)
            throw new NotFoundError('Chapter not found');
        return item;
    }
    async update(id, data) {
        await this.findById(id);
        return db.chapter.update({ where: { id }, data });
    }
    async delete(id) {
        await this.findById(id);
        return db.chapter.delete({ where: { id } });
    }
}
export const chapterService = new ChapterService();
