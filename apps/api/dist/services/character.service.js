import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';
export class CharacterService {
    async create(novelId, data) {
        return db.character.create({ data: { ...data, novelId } });
    }
    async findAll(novelId) {
        return db.character.findMany({ where: { novelId } });
    }
    async findById(id) {
        const item = await db.character.findUnique({ where: { id } });
        if (!item)
            throw new NotFoundError('Character not found');
        return item;
    }
    async update(id, data) {
        await this.findById(id);
        return db.character.update({ where: { id }, data });
    }
    async delete(id) {
        await this.findById(id);
        return db.character.delete({ where: { id } });
    }
}
export const characterService = new CharacterService();
