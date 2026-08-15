import { db } from '@ane/database';

export class ContextBuilder {
  static async buildStoryContext(novelId: string) {
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    const bible = await db.storyBible.findFirst({ where: { novelId, isCanonical: true }, orderBy: { version: 'desc' } });
    return `Title: ${novel?.title}\nPremise: ${novel?.premise}\nLogline: ${bible?.logline}\nSynopsis: ${bible?.synopsis}`;
  }

  static async buildSagaContext(novelId: string, sagaNumber: number) {
    const base = await this.buildStoryContext(novelId);
    return `${base}\nCurrently planning Saga ${sagaNumber}. Focus on major world conflicts and factions.`;
  }

  static async buildArcContext(novelId: string, sagaId: string) {
    const saga = await db.saga.findUnique({ where: { id: sagaId } });
    return `Saga Purpose: ${saga?.purpose}\nPrimary Conflict: ${saga?.primaryConflict}`;
  }

  static async buildChapterContext(novelId: string, miniArcId: string) {
    const miniArc = await db.miniArc.findUnique({ where: { id: miniArcId } });
    return `MiniArc Conflict: ${miniArc?.conflict}\nTurning Point: ${miniArc?.turningPoint}`;
  }
}
