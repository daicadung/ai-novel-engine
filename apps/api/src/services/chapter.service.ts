import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';

export class ChapterService {
  async create(novelId: string, data: any) {
    return (db as any).chapter.create({ data: { ...data, novelId } });
  }
  async findAll(novelId: string) {
    return (db as any).chapter.findMany({ where: { novelId } });
  }
  async findById(id: string) {
    const item = await (db as any).chapter.findUnique({ where: { id } });
    if (!item) throw new NotFoundError('Chapter not found');
    return item;
  }
  async update(id: string, data: any) {
    await this.findById(id);
    return (db as any).chapter.update({ where: { id }, data });
  }
  async delete(id: string) {
    await this.findById(id);
    return (db as any).chapter.delete({ where: { id } });
  }
}
export const chapterService = new ChapterService();
