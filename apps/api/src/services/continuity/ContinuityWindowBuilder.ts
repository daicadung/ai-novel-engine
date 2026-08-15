import { db } from '@ane/database';
import {
  ContinuityWindow,
  ContinuityWindowConfig,
  StoryState,
  PlotThreadState,
  ChapterMemory,
  KnowledgeState,
} from '@ane/core';
import { StoryStateManager } from './StoryStateManager.js';
import { KnowledgeBoundaryValidator } from './KnowledgeBoundaryValidator.js';

// Environment defaults
const DEFAULT_WINDOW_CHAPTERS = parseInt(process.env.CONTINUITY_WINDOW_CHAPTERS ?? '5', 10);
const DEFAULT_MAX_ENTITIES = parseInt(process.env.CONTINUITY_MAX_ENTITIES ?? '100', 10);
const DEFAULT_MAX_TOKENS = parseInt(process.env.CONTINUITY_MAX_TOKENS ?? '4000', 10);

/**
 * ContinuityWindowBuilder
 *
 * Builds the minimum necessary context window for LLM scene/prose generation.
 * NEVER sends the entire novel. Uses structured retrieval, not vector search.
 *
 * Output is used by:
 * - SceneManager.handler.prepareInput() (scene planning)
 * - ProseContextBuilder.buildContext() (prose generation)
 */
export class ContinuityWindowBuilder {
  // ====================================================================
  // Build continuity window for a chapter/scene
  // ====================================================================
  static async buildWindow(
    novelId: string,
    forChapter: number,
    options: {
      povCharacter?: string;
      participatingCharacters?: string[];
      participatingLocations?: string[];
      participatingFactions?: string[];
      activeThreadIds?: string[];
      windowChapters?: number;
      maxEntities?: number;
    } = {}
  ): Promise<ContinuityWindow> {
    const windowChapters = options.windowChapters ?? DEFAULT_WINDOW_CHAPTERS;
    const maxEntities = options.maxEntities ?? DEFAULT_MAX_ENTITIES;
    const maxTokenEstimate = DEFAULT_MAX_TOKENS;

    const config: ContinuityWindowConfig = {
      windowChapters,
      maxEntities,
      maxTokenEstimate,
      participatingCharacters: options.participatingCharacters ?? [],
      participatingLocations: options.participatingLocations ?? [],
      participatingFactions: options.participatingFactions ?? [],
      activeThreadIds: options.activeThreadIds ?? [],
    };

    // 1. Get canonical story state
    const storyStateRecord = await db.storyStateRecord.findFirst({
      where: { novelId, isCanonical: true },
      orderBy: { asOfChapter: 'desc' },
    });

    let currentState: StoryState;
    if (storyStateRecord) {
      currentState = storyStateRecord.state as unknown as StoryState;
    } else {
      // Fall back to latest canonical ContinuitySnapshot
      const snapshot = await db.continuitySnapshot.findFirst({
        where: { novelId, status: 'CANONICAL', chapterNumber: { lt: forChapter } },
        orderBy: { chapterNumber: 'desc' },
      });
      currentState = snapshot
        ? StoryStateManager.fromSnapshotJson(novelId, snapshot.chapterNumber, {
            characters: snapshot.characters as any,
            items: snapshot.items as any,
            locations: snapshot.locations as any,
            factions: snapshot.factions as any,
            plotThreads: snapshot.plotThreads as any,
            foreshadowing: snapshot.foreshadowing as any,
          })
        : StoryStateManager.empty(novelId, 0);
    }

    // 2. Filter state to only relevant entities
    const filteredState = this.filterStateByRelevance(currentState, config, maxEntities);

    // 3. Recent chapter memories (last N chapters)
    const recentMemories = await this.getRecentMemories(novelId, forChapter, windowChapters);

    // 4. Active plot threads
    const activeThreads = await this.getActiveThreads(novelId, config.activeThreadIds);

    // 5. POV character knowledge (if applicable)
    const relevantKnowledge: KnowledgeState[] = [];
    if (options.povCharacter) {
      const knowledge = await this.getCharacterKnowledge(
        novelId,
        options.povCharacter,
        forChapter
      );
      if (knowledge) relevantKnowledge.push(knowledge);
    }

    // 6. World facts (always include — they're bounded)
    const worldFacts = Object.values(currentState.worldFacts).filter((f) => !f.isRevoked);

    // 7. Estimate token cost
    const tokenEstimate = this.estimateTokens(
      filteredState,
      recentMemories,
      activeThreads,
      worldFacts
    );

    return {
      novelId,
      forChapter,
      currentState: filteredState,
      recentMemories,
      activeThreads,
      relevantCharacterKnowledge: relevantKnowledge,
      worldFacts,
      config,
      tokenEstimate,
    };
  }

  // ====================================================================
  // Build a compact text summary for LLM context injection
  // ====================================================================
  static formatForLLM(window: ContinuityWindow): string {
    const lines: string[] = [
      `=== CONTINUITY CONTEXT (Chapter ${window.forChapter}) ===`,
      '',
    ];

    // Characters
    const characters = Object.values(window.currentState.characters ?? {});
    if (characters.length > 0) {
      lines.push('ACTIVE CHARACTERS:');
      for (const c of characters.slice(0, 15)) {
        const status = c.isAlive ? 'ALIVE' : 'DEAD';
        const phys = c.physicalState ? JSON.stringify(c.physicalState) : '';
        lines.push(
          `  - ${c.name} [${status}]${c.location ? ` @ ${c.location}` : ''}${phys ? ` Physical: ${phys}` : ''}`
        );
      }
      lines.push('');
    }

    // Active plot threads
    if (window.activeThreads.length > 0) {
      lines.push('ACTIVE PLOT THREADS:');
      for (const t of window.activeThreads.slice(0, 10)) {
        lines.push(`  - [${t.status}][P${t.priority}] ${t.title}`);
        if (t.description) lines.push(`    ${t.description}`);
      }
      lines.push('');
    }

    // Recent memories
    if (window.recentMemories.length > 0) {
      lines.push('RECENT CHAPTER SUMMARIES:');
      for (const m of window.recentMemories) {
        lines.push(`  Chapter ${m.chapterNumber}: ${m.summary}`);
        if (m.keyEvents.length > 0) {
          lines.push(`  Key events: ${m.keyEvents.slice(0, 3).join(' | ')}`);
        }
      }
      lines.push('');
    }

    // Knowledge boundary note
    if (window.relevantCharacterKnowledge.length > 0) {
      const pov = window.relevantCharacterKnowledge[0];
      lines.push(`POV CHARACTER: ${pov.characterName}`);
      lines.push('NOTE: Generate from this character\'s knowledge only. Do NOT use global truth not known to them.');
      if (pov.misconceptions.length > 0) {
        lines.push('CHARACTER BELIEFS (may differ from truth):');
        for (const m of pov.misconceptions.slice(0, 5)) {
          lines.push(`  - Believes: ${m.belief}`);
        }
      }
      lines.push('');
    }

    // World facts
    if (window.worldFacts.length > 0) {
      lines.push('WORLD RULES:');
      for (const f of window.worldFacts.slice(0, 10)) {
        lines.push(`  [${f.category}] ${f.fact}`);
      }
      lines.push('');
    }

    lines.push(`=== END CONTINUITY CONTEXT ===`);
    return lines.join('\n');
  }

  // ====================================================================
  // Private helpers
  // ====================================================================

  private static filterStateByRelevance(
    state: StoryState,
    config: ContinuityWindowConfig,
    maxEntities: number
  ): Partial<StoryState> {
    const participants = new Set([
      ...config.participatingCharacters,
      ...config.participatingLocations,
      ...config.participatingFactions,
    ]);

    // Filter characters
    const filteredChars: Record<string, any> = {};
    let count = 0;
    for (const [id, char] of Object.entries(state.characters)) {
      if (count >= maxEntities) break;
      if (participants.has(id) || participants.has(char.name) || char.isAlive) {
        filteredChars[id] = char;
        count++;
      }
    }

    // Filter locations
    const filteredLocs: Record<string, any> = {};
    for (const [id, loc] of Object.entries(state.locations)) {
      if (
        participants.has(id) ||
        participants.has(loc.name) ||
        config.participatingLocations.length === 0
      ) {
        filteredLocs[id] = loc;
      }
    }

    // Filter items (only possessed by participants or mentioned)
    const filteredItems: Record<string, any> = {};
    for (const [id, item] of Object.entries(state.items)) {
      if (
        (item.ownerId && participants.has(item.ownerId)) ||
        !item.isDestroyed
      ) {
        filteredItems[id] = item;
      }
    }

    return {
      novelId: state.novelId,
      asOfChapter: state.asOfChapter,
      characters: filteredChars,
      locations: filteredLocs,
      items: filteredItems,
      factions: state.factions,
      quests: state.quests,
      worldFacts: state.worldFacts,
      mysteries: {},  // Mysteries filtered separately by knowledge boundary
    };
  }

  private static async getRecentMemories(
    novelId: string,
    beforeChapter: number,
    count: number
  ): Promise<ChapterMemory[]> {
    const records = await db.chapterMemoryRecord.findMany({
      where: { novelId, chapterNumber: { lt: beforeChapter } },
      orderBy: { chapterNumber: 'desc' },
      take: count,
    });

    return records.map((r) => ({
      chapterId: r.chapterId,
      novelId: r.novelId,
      chapterNumber: r.chapterNumber,
      summary: r.summary,
      keyEvents: (r.keyEvents as string[]) ?? [],
      stateDeltas: (r.stateDeltas as any[]) ?? [],
      introducedCharacters: (r.metadata as any)?.introducedCharacters ?? [],
      changedRelationships: (r.metadata as any)?.changedRelationships ?? [],
      revelations: (r.metadata as any)?.revelations ?? [],
      unresolvedThreads: (r.metadata as any)?.unresolvedThreads ?? [],
      resolvedThreads: (r.metadata as any)?.resolvedThreads ?? [],
      locations: (r.metadata as any)?.locations ?? [],
      importantItems: (r.metadata as any)?.importantItems ?? [],
      emotionalTurningPoints: (r.metadata as any)?.emotionalTurningPoints ?? [],
    }));
  }

  private static async getActiveThreads(
    novelId: string,
    filterIds: string[]
  ): Promise<PlotThreadState[]> {
    const threads = await db.plotThread.findMany({
      where: {
        novelId,
        status: { in: ['SETUP', 'DEVELOPING', 'ACTIVE', 'OPEN'] },
        ...(filterIds.length > 0 ? { id: { in: filterIds } } : {}),
      },
      orderBy: { importance: 'desc' },
      take: 20,
    });

    return threads.map((t) => ({
      id: t.id,
      title: t.title,
      status: 'ACTIVE' as const,
      priority: t.importance,
      introducedChapter: t.introducedChapter ?? undefined,
      description: t.description,
    }));
  }

  private static async getCharacterKnowledge(
    novelId: string,
    characterId: string,
    asOfChapter: number
  ): Promise<KnowledgeState | null> {
    const record = await db.knowledgeStateRecord.findFirst({
      where: {
        novelId,
        characterId,
        asOfChapter: { lte: asOfChapter },
        isCanonical: true,
      },
      orderBy: { asOfChapter: 'desc' },
    });

    if (!record) return null;

    return record.knowledge as unknown as KnowledgeState;
  }

  private static estimateTokens(
    state: Partial<StoryState>,
    memories: ChapterMemory[],
    threads: PlotThreadState[],
    worldFacts: any[]
  ): number {
    const charCount = Object.keys(state.characters ?? {}).length;
    const memCount = memories.length;
    const threadCount = threads.length;
    const factCount = worldFacts.length;

    // Rough estimate: characters ~100 tokens each, memories ~150, threads ~80, facts ~50
    return charCount * 100 + memCount * 150 + threadCount * 80 + factCount * 50;
  }
}
