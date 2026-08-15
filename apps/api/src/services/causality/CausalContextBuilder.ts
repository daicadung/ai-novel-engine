import { db } from '@ane/database';
import { CausalContext } from '@ane/core';
import { WorldReactionAnalyzer } from './WorldReactionAnalyzer.js';

export class CausalContextBuilder {
  /**
   * Builds bounded causal context for the prose generator or chapter objective planner.
   * Limits output to prevent context window bloat.
   */
  static async buildContext(novelId: string, chapterNumber: number): Promise<CausalContext> {
    // 1. Recent significant events (last 5 chapters)
    const recentEvents = await db.causalEventRecord.findMany({
      where: {
        novelId,
        chapterNumber: { gte: chapterNumber - 5, lt: chapterNumber },
        importance: { in: ['SIGNIFICANT', 'MAJOR', 'CRITICAL'] }
      },
      orderBy: { chapterNumber: 'desc' },
      take: 5
    });

    // 2. Unresolved consequences (ACTIVE only)
    const activeConsequences = await db.consequenceRecord.findMany({
      where: {
        novelId,
        status: 'ACTIVE'
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // 3. Active dependencies
    const activeDependencies = await db.causalDependencyRecord.findMany({
      where: {
        novelId,
        status: 'ACTIVE'
      },
      take: 10
    });

    // 4. Pending reactions
    const pendingReactions = await WorldReactionAnalyzer.analyzePendingReactions(novelId, chapterNumber);
    const missingReactions = pendingReactions.filter(r => r.status === 'REACTION_MISSING');

    // 5. Relevant affected entities (aggregate from above)
    const affectedEntities = new Set<string>();
    activeConsequences.forEach(c => {
      if (c.targetEntityId) affectedEntities.add(c.targetEntityId);
    });
    activeDependencies.forEach(d => {
      affectedEntities.add(d.dependentEntityId);
    });

    return {
      recentSignificantEvents: recentEvents as any,
      unresolvedConsequences: activeConsequences as any,
      activeDependencies: activeDependencies as any,
      pendingReactions: missingReactions,
      relevantAffectedEntities: Array.from(affectedEntities),
    };
  }

  /**
   * Formats the causal context into a string for LLM prompts.
   */
  static formatForPrompt(context: CausalContext): string {
    if (
      context.recentSignificantEvents.length === 0 &&
      context.unresolvedConsequences.length === 0 &&
      context.pendingReactions.length === 0
    ) {
      return '';
    }

    let output = '\n--- CAUSAL CONTEXT ---\n';
    
    if (context.recentSignificantEvents.length > 0) {
      output += 'Recent Significant Events:\n';
      for (const e of context.recentSignificantEvents) {
        output += `- Ch ${e.chapterNumber}: ${e.eventType} (Targets: ${e.targetIds.join(', ')})\n`;
      }
    }

    if (context.unresolvedConsequences.length > 0) {
      output += '\nActive Consequences:\n';
      for (const c of context.unresolvedConsequences) {
        output += `- ${c.description}\n`;
      }
    }

    if (context.pendingReactions.length > 0) {
      output += '\nMissing World Reactions (Overdue):\n';
      for (const r of context.pendingReactions) {
        output += `- Event ${r.eventId} (${r.eventType}) happened ${r.chaptersPassed} chapters ago. The world MUST react.\n`;
      }
    }

    return output;
  }
}
