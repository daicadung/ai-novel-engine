import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';

export class LocationService {
  async create(novelId: string, data: any) {
    return (db as any).location.create({ data: { ...data, novelId } });
  }
  async findAll(novelId: string) {
    return (db as any).location.findMany({ where: { novelId } });
  }
  async findById(id: string) {
    const item = await (db as any).location.findUnique({ where: { id } });
    if (!item) throw new NotFoundError('Location not found');
    return item;
  }
  async update(id: string, data: any) {
    await this.findById(id);
    return (db as any).location.update({ where: { id }, data });
  }
  async delete(id: string) {
    await this.findById(id);
    return (db as any).location.delete({ where: { id } });
  }
}
export const locationService = new LocationService();
