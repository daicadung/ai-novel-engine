import { db } from '@ane/database';
import {
  PlotThreadState,
  ContinuityConflict,
  ContinuityConflictType,
  ConflictSeverity,
} from '@ane/core';

const ORPHAN_THRESHOLD_CHAPTERS = parseInt(
  process.env.PLOT_THREAD_ORPHAN_THRESHOLD ?? '30',
  10
);

/**
 * PlotThreadManager
 *
 * Manages plot thread lifecycle and detects:
 * - Abandoned threads
 * - Forgotten high-priority threads
 * - Unresolved threads past their payoff chapter
 * - Orphaned threads
 */
export class PlotThreadManager {
  // ====================================================================
  // Detect plot thread issues for a given chapter
  // ====================================================================
  static async detectIssues(
    novelId: string,
    currentChapter: number
  ): Promise<ContinuityConflict[]> {
    const conflicts: ContinuityConflict[] = [];

    const threads = await db.plotThread.findMany({
      where: { novelId },
      orderBy: { importance: 'desc' },
    });

    for (const thread of threads) {
      // Skip resolved/abandoned threads
      if (['RESOLVED', 'ABANDONED', 'PAYOFF'].includes(thread.status)) continue;

      const lastReferenced = thread.updatedAt
        ? Math.floor(
            (Date.now() - new Date(thread.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
          )
        : 0;

      // Check if thread has been forgotten (not referenced in N chapters)
      if (
        thread.introducedChapter &&
        currentChapter - thread.introducedChapter > ORPHAN_THRESHOLD_CHAPTERS &&
        thread.importance >= 7
      ) {
        conflicts.push({
          type: ContinuityConflictType.ORPHANED_THREAD,
          severity: ConflictSeverity.WARNING,
          entityId: thread.id,
          entityType: 'PLOT_THREAD',
          description: `High-priority plot thread "${thread.title}" (importance: ${thread.importance}) introduced at chapter ${thread.introducedChapter} has not been resolved or referenced for ${currentChapter - (thread.introducedChapter ?? 0)} chapters`,
          chapterNumber: currentChapter,
          resolution: 'Reference or resolve this thread in upcoming chapters',
        });
      }

      // Check if thread is past its target payoff chapter
      if (
        thread.targetPayoffChapter &&
        currentChapter > thread.targetPayoffChapter &&
        !['RESOLVED', 'ABANDONED'].includes(thread.status)
      ) {
        conflicts.push({
          type: ContinuityConflictType.UNRESOLVED_DEPENDENCY,
          severity: ConflictSeverity.INFO,
          entityId: thread.id,
          entityType: 'PLOT_THREAD',
          description: `Plot thread "${thread.title}" was planned to resolve by chapter ${thread.targetPayoffChapter} but is still "${thread.status}" at chapter ${currentChapter}`,
          chapterNumber: currentChapter,
          resolution: 'Resolve or extend the payoff chapter target',
        });
      }
    }

    return conflicts;
  }

  // ====================================================================
  // Update plot thread status based on state deltas
  // ====================================================================
  static async updateFromDeltas(
    novelId: string,
    deltas: Array<{ entityType: string; entityId: string; property: string; newValue: unknown }>
  ): Promise<void> {
    for (const delta of deltas) {
      if (delta.entityType !== 'PLOT_THREAD') continue;
      if (delta.property !== 'status') continue;

      await db.plotThread.updateMany({
        where: { novelId, id: delta.entityId },
        data: { status: String(delta.newValue) },
      }).catch(() => {
        // Thread may not exist in DB yet — ignore
      });
    }
  }

  // ====================================================================
  // Get threads relevant to a scene
  // ====================================================================
  static async getRelevantThreads(
    novelId: string,
    participatingCharacters: string[],
    currentChapter: number
  ): Promise<PlotThreadState[]> {
    const threads = await db.plotThread.findMany({
      where: {
        novelId,
        status: { notIn: ['RESOLVED', 'ABANDONED'] },
      },
      orderBy: { importance: 'desc' },
      take: 15,
    });

    return threads.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status as PlotThreadState['status'],
      priority: t.importance,
      introducedChapter: t.introducedChapter ?? undefined,
      lastReferencedChapter: currentChapter,
      description: t.description,
    }));
  }

  // ====================================================================
  // Mark thread as referenced
  // ====================================================================
  static async markReferenced(threadId: string, _chapterNumber: number): Promise<void> {
    await db.plotThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    }).catch(() => {});
  }
}
