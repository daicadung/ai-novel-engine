import { db } from '@ane/database';
import { NotFoundError } from '../errors/index.js';

export class StoryBibleService {
  async create(novelId: string, data: any) {
    return (db as any).storyBible.create({ data: { ...data, novelId } });
  }
  async findAll(novelId: string) {
    return (db as any).storyBible.findMany({ where: { novelId } });
  }
  async findById(id: string) {
    const item = await (db as any).storyBible.findUnique({ where: { id } });
    if (!item) throw new NotFoundError('StoryBible not found');
    return item;
  }
  async update(id: string, data: any) {
    await this.findById(id);
    return (db as any).storyBible.update({ where: { id }, data });
  }
  async delete(id: string) {
    await this.findById(id);
    return (db as any).storyBible.delete({ where: { id } });
  }
}
export const storyBibleService = new StoryBibleService();
