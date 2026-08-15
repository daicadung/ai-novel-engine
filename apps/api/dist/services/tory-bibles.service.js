import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';
export class StoryBibleService {
    async create(novelId, data) {
        return db.storyBible.create({ data: { ...data, novelId } });
    }
    async findAll(novelId) {
        return db.storyBible.findMany({ where: { novelId } });
    }
    async findById(id) {
        const item = await db.storyBible.findUnique({ where: { id } });
        if (!item)
            throw new NotFoundError('StoryBible not found');
        return item;
    }
    async update(id, data) {
        await this.findById(id);
        return db.storyBible.update({ where: { id }, data });
    }
    async delete(id) {
        await this.findById(id);
        return db.storyBible.delete({ where: { id } });
    }
}
export const storyBibleService = new StoryBibleService();
