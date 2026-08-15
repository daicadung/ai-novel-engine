import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';

export class EventService {
  async create(novelId: string, data: any) {
    return (db as any).event.create({ data: { ...data, novelId } });
  }
  async findAll(novelId: string) {
    return (db as any).event.findMany({ where: { novelId } });
  }
  async findById(id: string) {
    const item = await (db as any).event.findUnique({ where: { id } });
    if (!item) throw new NotFoundError('Event not found');
    return item;
  }
  async update(id: string, data: any) {
    await this.findById(id);
    return (db as any).event.update({ where: { id }, data });
  }
  async delete(id: string) {
    await this.findById(id);
    return (db as any).event.delete({ where: { id } });
  }
}
export const eventService = new EventService();
