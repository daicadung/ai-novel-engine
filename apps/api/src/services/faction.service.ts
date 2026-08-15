import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';

export class FactionService {
  async create(novelId: string, data: any) {
    return (db as any).faction.create({ data: { ...data, novelId } });
  }
  async findAll(novelId: string) {
    return (db as any).faction.findMany({ where: { novelId } });
  }
  async findById(id: string) {
    const item = await (db as any).faction.findUnique({ where: { id } });
    if (!item) throw new NotFoundError('Faction not found');
    return item;
  }
  async update(id: string, data: any) {
    await this.findById(id);
    return (db as any).faction.update({ where: { id }, data });
  }
  async delete(id: string) {
    await this.findById(id);
    return (db as any).faction.delete({ where: { id } });
  }
}
export const factionService = new FactionService();
