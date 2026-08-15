import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';

export class CharacterService {
  async create(novelId: string, data: any) {
    return (db as any).character.create({ data: { ...data, novelId } });
  }
  async findAll(novelId: string) {
    return (db as any).character.findMany({ where: { novelId } });
  }
  async findById(id: string) {
    const item = await (db as any).character.findUnique({ where: { id } });
    if (!item) throw new NotFoundError('Character not found');
    return item;
  }
  async update(id: string, data: any) {
    await this.findById(id);
    return (db as any).character.update({ where: { id }, data });
  }
  async delete(id: string) {
    await this.findById(id);
    return (db as any).character.delete({ where: { id } });
  }
}
export const characterService = new CharacterService();
