import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';

export class RelationshipService {
  async create(novelId: string, data: any) {
    return (db as any).relationship.create({ data: { ...data, novelId } });
  }
  async findAll(novelId: string) {
    return (db as any).relationship.findMany({ where: { novelId } });
  }
  async findById(id: string) {
    const item = await (db as any).relationship.findUnique({ where: { id } });
    if (!item) throw new NotFoundError('Relationship not found');
    return item;
  }
  async update(id: string, data: any) {
    await this.findById(id);
    return (db as any).relationship.update({ where: { id }, data });
  }
  async delete(id: string) {
    await this.findById(id);
    return (db as any).relationship.delete({ where: { id } });
  }
}
export const relationshipService = new RelationshipService();
