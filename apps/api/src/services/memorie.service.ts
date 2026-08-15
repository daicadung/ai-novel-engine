import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';

export class MemoryService {
  async create(novelId: string, data: any) {
    return (db as any).memory.create({ data: { ...data, novelId } });
  }
  async findAll(novelId: string) {
    return (db as any).memory.findMany({ where: { novelId } });
  }
  async findById(id: string) {
    const item = await (db as any).memory.findUnique({ where: { id } });
    if (!item) throw new NotFoundError('Memory not found');
    return item;
  }
  async update(id: string, data: any) {
    await this.findById(id);
    return (db as any).memory.update({ where: { id }, data });
  }
  async delete(id: string) {
    await this.findById(id);
    return (db as any).memory.delete({ where: { id } });
  }
}
export const memoryService = new MemoryService();
