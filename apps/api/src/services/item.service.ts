import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';

export class ItemService {
  async create(novelId: string, data: any) {
    return (db as any).item.create({ data: { ...data, novelId } });
  }
  async findAll(novelId: string) {
    return (db as any).item.findMany({ where: { novelId } });
  }
  async findById(id: string) {
    const item = await (db as any).item.findUnique({ where: { id } });
    if (!item) throw new NotFoundError('Item not found');
    return item;
  }
  async update(id: string, data: any) {
    await this.findById(id);
    return (db as any).item.update({ where: { id }, data });
  }
  async delete(id: string) {
    await this.findById(id);
    return (db as any).item.delete({ where: { id } });
  }
}
export const itemService = new ItemService();
