import { db } from '@ane/database';
import {
  ChapterMemory,
  ChapterMemorySchema,
  StateDelta,
  StoryState,
} from '@ane/core';
import { StoryStateManager } from './StoryStateManager.js';

/**
 * ChapterMemoryManager
 *
 * Manages the three-layer memory system:
 * LAYER 1 — Current canonical StoryState (always up to date)
 * LAYER 2 — Recent chapter memories (last N)
 * LAYER 3 — Historical memories (selective retrieval by relevance)
 *
 * Called after successful canonical prose promotion.
 */
export class ChapterMemoryManager {
  // ====================================================================
  // Create chapter memory after canonical promotion
  // ====================================================================
  static async createMemory(
    novelId: string,
    chapterId: string,
    chapterNumber: number,
    stateDeltas: StateDelta[],
    chapterSummary: string,
    options: {
      keyEvents?: string[];
      introducedCharacters?: string[];
      revelations?: string[];
      resolvedThreads?: string[];
      unresolvedThreads?: string[];
      locations?: string[];
      importantItems?: string[];
      emotionalTurningPoints?: string[];
      changedRelationships?: string[];
      povCharacter?: string;
    } = {}
  ): Promise<ChapterMemory> {
    const memory: ChapterMemory = ChapterMemorySchema.parse({
      chapterId,
      novelId,
      chapterNumber,
      summary: chapterSummary.slice(0, 1500),
      keyEvents: (options.keyEvents ?? []).slice(0, 10),
      stateDeltas: stateDeltas.slice(0, 30).map((d) => ({
        entityType: d.entityType,
        entityId: d.entityId,
        property: d.property,
        newValue: String(d.newValue),
      })),
      introducedCharacters: options.introducedCharacters ?? [],
      changedRelationships: options.changedRelationships ?? [],
      revelations: options.revelations ?? [],
      unresolvedThreads: options.unresolvedThreads ?? [],
      resolvedThreads: options.resolvedThreads ?? [],
      locations: options.locations ?? [],
      importantItems: options.importantItems ?? [],
      emotionalTurningPoints: options.emotionalTurningPoints ?? [],
      povCharacter: options.povCharacter,
    });

    // Upsert — idempotent
    await db.chapterMemoryRecord.upsert({
      where: { chapterId },
      create: {
        novelId,
        chapterId,
        chapterNumber,
        summary: memory.summary,
        keyEvents: memory.keyEvents,
        stateDeltas: memory.stateDeltas,
        metadata: {
          introducedCharacters: memory.introducedCharacters,
          changedRelationships: memory.changedRelationships,
          revelations: memory.revelations,
          unresolvedThreads: memory.unresolvedThreads,
          resolvedThreads: memory.resolvedThreads,
          locations: memory.locations,
          importantItems: memory.importantItems,
          emotionalTurningPoints: memory.emotionalTurningPoints,
          povCharacter: memory.povCharacter,
        },
      },
      update: {
        summary: memory.summary,
        keyEvents: memory.keyEvents,
        stateDeltas: memory.stateDeltas,
        metadata: {
          introducedCharacters: memory.introducedCharacters,
          changedRelationships: memory.changedRelationships,
          revelations: memory.revelations,
          resolvedThreads: memory.resolvedThreads,
          unresolvedThreads: memory.unresolvedThreads,
          locations: memory.locations,
          importantItems: memory.importantItems,
          emotionalTurningPoints: memory.emotionalTurningPoints,
        },
      },
    });

    return memory;
  }

  // ====================================================================
  // Promote StoryState after a chapter becomes canonical
  // ====================================================================
  static async promoteStoryState(
    novelId: string,
    chapterNumber: number,
    stateDeltas: StateDelta[],
    snapshotId?: string
  ): Promise<void> {
    // Get current canonical state
    const existing = await db.storyStateRecord.findFirst({
      where: { novelId, isCanonical: true },
      orderBy: { asOfChapter: 'desc' },
    });

    let currentState: StoryState;
    if (existing) {
      currentState = existing.state as unknown as StoryState;
    } else {
      // Bootstrap from snapshot
      const snapshot = await db.continuitySnapshot.findFirst({
        where: { novelId, status: 'CANONICAL' },
        orderBy: { chapterNumber: 'desc' },
      });
      currentState = snapshot
        ? StoryStateManager.fromSnapshotJson(novelId, snapshot.chapterNumber, {
            characters: snapshot.characters as any,
            items: snapshot.items as any,
            locations: snapshot.locations as any,
            factions: snapshot.factions as any,
            plotThreads: snapshot.plotThreads as any,
          })
        : StoryStateManager.empty(novelId, 0);
    }

    // Apply deltas
    const nextState = StoryStateManager.applyDeltas(currentState, stateDeltas, chapterNumber);

    await db.$transaction(async (tx) => {
      // Mark existing canonical state non-canonical (historical, never deleted)
      if (existing) {
        await tx.storyStateRecord.update({
          where: { id: existing.id },
          data: { isCanonical: false },
        });
      }

      // Create new canonical state
      await tx.storyStateRecord.create({
        data: {
          novelId,
          asOfChapter: chapterNumber,
          state: nextState as any,
          isCanonical: true,
          snapshotId: snapshotId ?? null,
        },
      });

      // Update Novel.lastCanonicalChapter
      await tx.novel.update({
        where: { id: novelId },
        data: { lastCanonicalChapter: chapterNumber },
      });
    });
  }

  // ====================================================================
  // Get memory for a chapter
  // ====================================================================
  static async getMemory(chapterId: string): Promise<ChapterMemory | null> {
    const record = await db.chapterMemoryRecord.findUnique({
      where: { chapterId },
    });
    if (!record) return null;

    return {
      chapterId: record.chapterId,
      novelId: record.novelId,
      chapterNumber: record.chapterNumber,
      summary: record.summary,
      keyEvents: record.keyEvents as string[],
      stateDeltas: record.stateDeltas as any[],
      introducedCharacters: (record.metadata as any)?.introducedCharacters ?? [],
      changedRelationships: (record.metadata as any)?.changedRelationships ?? [],
      revelations: (record.metadata as any)?.revelations ?? [],
      unresolvedThreads: (record.metadata as any)?.unresolvedThreads ?? [],
      resolvedThreads: (record.metadata as any)?.resolvedThreads ?? [],
      locations: (record.metadata as any)?.locations ?? [],
      importantItems: (record.metadata as any)?.importantItems ?? [],
      emotionalTurningPoints: (record.metadata as any)?.emotionalTurningPoints ?? [],
    };
  }

  // ====================================================================
  // Mark chapters NEEDS_REVIEW when their state dependencies change
  // ====================================================================
  static async invalidateDependentContent(
    novelId: string,
    fromChapter: number,
    affectedEntityKeys: string[]  // "ENTITY_TYPE:entityId:property"
  ): Promise<number> {
    if (affectedEntityKeys.length === 0) return 0;

    // Find chapter memories after fromChapter that reference these entity keys
    const laterMemories = await db.chapterMemoryRecord.findMany({
      where: {
        novelId,
        chapterNumber: { gt: fromChapter },
      },
      orderBy: { chapterNumber: 'asc' },
    });

    const chaptersToInvalidate: string[] = [];

    for (const memory of laterMemories) {
      const deltas = memory.stateDeltas as unknown as StateDelta[];

      const hasReference = deltas.some((d) => {
        const key = `${d.entityType}:${d.entityId}:${d.property}`;
        return affectedEntityKeys.includes(key);
      });

      if (hasReference) {
        chaptersToInvalidate.push(memory.chapterId);
      }
    }

    if (chaptersToInvalidate.length === 0) return 0;

    // Mark prose versions as NEEDS_REVIEW (STALE) — non-destructive
    // We mark the ChapterProseVersion as STALE which triggers review
    let invalidated = 0;
    for (const chapterId of chaptersToInvalidate) {
      const chapterProse = await db.chapterProse.findUnique({
        where: { chapterId },
        include: {
          versions: { where: { status: 'CANONICAL' }, take: 1 },
        },
      });

      if (chapterProse?.versions[0]) {
        await db.chapterProseVersion.update({
          where: { id: chapterProse.versions[0].id },
          data: { status: 'STALE' },
        });
        invalidated++;
      }
    }

    return invalidated;
  }

  // ====================================================================
  // Get all state deltas from a chapter's canonical scenes
  // ====================================================================
  static async extractStateDeltas(chapterId: string): Promise<StateDelta[]> {
    const chapter = await db.chapter.findUnique({
      where: { id: chapterId },
      include: {
        scenePlanVersions: {
          where: { status: 'CANONICAL' },
          take: 1,
          include: {
            scenes: {
              include: {
                stateChanges: true,
              },
            },
          },
        },
      },
    });

    if (!chapter?.scenePlanVersions?.[0]) return [];

    const allChanges = chapter.scenePlanVersions[0].scenes.flatMap((s) =>
      s.stateChanges.map((sc) => ({
        entityType: sc.entityType as any,
        entityId: sc.entityId,
        property: sc.property,
        previousValue: sc.previousValue,
        newValue: sc.newValue,
        sourceSceneId: s.id,
        sourceChapterId: chapterId,
        sourceChapterNumber: chapter.number,
        reason: sc.reason ?? undefined,
      }))
    );

    return allChanges;
  }
}
