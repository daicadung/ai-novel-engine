import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';

export class PlotThreadService {
  async create(novelId: string, data: any) {
    return (db as any).plotThread.create({ data: { ...data, novelId } });
  }
  async findAll(novelId: string) {
    return (db as any).plotThread.findMany({ where: { novelId } });
  }
  async findById(id: string) {
    const item = await (db as any).plotThread.findUnique({ where: { id } });
    if (!item) throw new NotFoundError('PlotThread not found');
    return item;
  }
  async update(id: string, data: any) {
    await this.findById(id);
    return (db as any).plotThread.update({ where: { id }, data });
  }
  async delete(id: string) {
    await this.findById(id);
    return (db as any).plotThread.delete({ where: { id } });
  }
}
export const plotThreadService = new PlotThreadService();
