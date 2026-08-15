import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';

export class ArcService {
  async create(novelId: string, data: any) {
    return (db as any).arc.create({ data: { ...data, novelId } });
  }
  async findAll(novelId: string) {
    return (db as any).arc.findMany({ where: { novelId } });
  }
  async findById(id: string) {
    const item = await (db as any).arc.findUnique({ where: { id } });
    if (!item) throw new NotFoundError('Arc not found');
    return item;
  }
  async update(id: string, data: any) {
    await this.findById(id);
    return (db as any).arc.update({ where: { id }, data });
  }
  async delete(id: string) {
    await this.findById(id);
    return (db as any).arc.delete({ where: { id } });
  }
}
export const arcService = new ArcService();
