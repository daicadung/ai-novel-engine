import { db } from '@ane/database';
import { ImportanceLevel, CausalEventType } from '@ane/core';

export class WorldReactionAnalyzer {
  /**
   * Determine expected reaction windows for significant events.
   * SIGNIFICANT: 1-8 chapters
   * MAJOR: 1-5 chapters
   * CRITICAL: 0-3 chapters (immediate to 3)
   */
  static getReactionWindow(importance: string): number {
    if (importance === ImportanceLevel.CRITICAL) return 3;
    if (importance === ImportanceLevel.MAJOR) return 5;
    if (importance === ImportanceLevel.SIGNIFICANT) return 8;
    return 10;
  }

  /**
   * Analyzes recent major events to see if the story has reacted to them yet.
   */
  static async analyzePendingReactions(novelId: string, currentChapterNumber: number): Promise<any[]> {
    // Look back up to 10 chapters for significant events
    const recentEvents = await db.causalEventRecord.findMany({
      where: {
        novelId,
        chapterNumber: { gte: currentChapterNumber - 10, lt: currentChapterNumber },
        importance: { in: ['SIGNIFICANT', 'MAJOR', 'CRITICAL'] }
      }
    });

    const pendingReactions = [];

    for (const event of recentEvents) {
      const window = this.getReactionWindow(event.importance);
      const chaptersPassed = currentChapterNumber - event.chapterNumber;
      
      // If we are still within the window, or just passed it, check for downstream effects
      if (chaptersPassed <= window + 2) {
        // Has there been any derived event (reaction) from this event?
        const reactions = await db.causalRelationRecord.count({
          where: {
            novelId,
            causeEventId: event.id
          }
        });

        if (reactions === 0) {
          const status = chaptersPassed > window ? 'REACTION_MISSING' : 'REACTION_EXPECTED';
          pendingReactions.push({
            eventId: event.id,
            eventType: event.eventType,
            importance: event.importance,
            status,
            chaptersPassed,
            windowMax: window,
          });
        }
      }
    }

    return pendingReactions;
  }
}
