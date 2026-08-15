import {
  StoryState,
  StoryStateSchema,
  StateDelta,
  EntityTypeEnum,
} from '@ane/core';

/**
 * StoryState — Functional helpers for computing and applying state deltas.
 *
 * This module is PURE (no DB access) — all DB operations are in ChapterMemoryManager
 * and ContinuityWindowBuilder which call these helpers.
 */
export class StoryStateManager {
  // ====================================================================
  // Create empty state
  // ====================================================================
  static empty(novelId: string, asOfChapter = 0): StoryState {
    return StoryStateSchema.parse({
      novelId,
      asOfChapter,
      characters: {},
      relationships: {},
      locations: {},
      items: {},
      abilities: {},
      factions: {},
      mysteries: {},
      quests: {},
      worldFacts: {},
      timeline: {},
      customEntities: {},
    });
  }

  // ====================================================================
  // Apply a list of deltas to produce the next state (immutable)
  // ====================================================================
  static applyDeltas(state: StoryState, deltas: StateDelta[], toChapter: number): StoryState {
    // Deep clone to preserve immutability
    const next: StoryState = JSON.parse(JSON.stringify(state));
    next.asOfChapter = toChapter;

    for (const delta of deltas) {
      StoryStateManager.applyOneDelta(next, delta);
    }

    return next;
  }

  // ====================================================================
  // Convert legacy ContinuitySnapshot JSON to typed StoryState
  // ====================================================================
  static fromSnapshotJson(
    novelId: string,
    chapterNumber: number,
    raw: {
      characters?: Record<string, unknown>;
      items?: Record<string, unknown>;
      locations?: Record<string, unknown>;
      factions?: Record<string, unknown>;
      plotThreads?: Record<string, unknown>;
      foreshadowing?: Record<string, unknown>;
    }
  ): StoryState {
    const state = StoryStateManager.empty(novelId, chapterNumber);

    // Map legacy character objects
    if (raw.characters) {
      for (const [id, val] of Object.entries(raw.characters)) {
        const c = val as any;
        state.characters[id] = {
          id,
          name: c.name ?? id,
          isAlive: c.isAlive ?? c.alive ?? true,
          location: c.location,
          physicalState: c.physicalState ?? c.injuries,
          abilities: c.abilities,
          possessions: c.possessions ?? c.items,
          emotionalState: c.emotionalState,
          goals: c.goals,
          secrets: c.secrets,
          lastSeenChapter: chapterNumber,
        };
      }
    }

    // Map legacy locations
    if (raw.locations) {
      for (const [id, val] of Object.entries(raw.locations)) {
        const l = val as any;
        state.locations[id] = {
          id,
          name: l.name ?? id,
          isAccessible: l.isAccessible ?? true,
          controlledBy: l.controlledBy,
          status: l.status,
          lastChapter: chapterNumber,
        };
      }
    }

    // Map legacy items
    if (raw.items) {
      for (const [id, val] of Object.entries(raw.items)) {
        const i = val as any;
        state.items[id] = {
          id,
          name: i.name ?? id,
          ownerId: i.ownerId ?? i.owner,
          ownerType: i.ownerType ?? 'CHARACTER',
          location: i.location,
          condition: i.condition,
          isDestroyed: i.isDestroyed ?? false,
          lastChapter: chapterNumber,
        };
      }
    }

    // Map legacy factions
    if (raw.factions) {
      for (const [id, val] of Object.entries(raw.factions)) {
        const f = val as any;
        state.factions[id] = {
          id,
          name: f.name ?? id,
          status: f.status,
          power: f.power,
          lastChapter: chapterNumber,
        };
      }
    }

    // Map plot threads
    if (raw.plotThreads) {
      for (const [id, val] of Object.entries(raw.plotThreads)) {
        const pt = val as any;
        state.quests[id] = {
          id,
          title: pt.title ?? id,
          status: pt.status ?? 'ACTIVE',
          priority: pt.importance ?? 5,
          introducedChapter: pt.introducedChapter,
          lastReferencedChapter: chapterNumber,
          description: pt.description,
        };
      }
    }

    return state;
  }

  // ====================================================================
  // Private: apply one delta mutably on next state
  // ====================================================================
  private static applyOneDelta(state: StoryState, delta: StateDelta): void {
    const { entityType, entityId, property, newValue } = delta;

    switch (entityType) {
      case EntityTypeEnum.CHARACTER: {
        if (!state.characters[entityId]) {
          state.characters[entityId] = {
            id: entityId,
            name: entityId,
            isAlive: true,
          };
        }
        (state.characters[entityId] as any)[property] = newValue;
        break;
      }
      case EntityTypeEnum.LOCATION: {
        if (!state.locations[entityId]) {
          state.locations[entityId] = { id: entityId, name: entityId, isAccessible: true };
        }
        (state.locations[entityId] as any)[property] = newValue;
        break;
      }
      case EntityTypeEnum.ITEM: {
        if (!state.items[entityId]) {
          state.items[entityId] = { id: entityId, name: entityId, isDestroyed: false };
        }
        (state.items[entityId] as any)[property] = newValue;
        break;
      }
      case EntityTypeEnum.FACTION: {
        if (!state.factions[entityId]) {
          state.factions[entityId] = { id: entityId, name: entityId };
        }
        (state.factions[entityId] as any)[property] = newValue;
        break;
      }
      case EntityTypeEnum.PLOT_THREAD: {
        if (!state.quests[entityId]) {
          state.quests[entityId] = {
            id: entityId,
            title: entityId,
            status: 'OPEN',
            priority: 5,
          };
        }
        (state.quests[entityId] as any)[property] = newValue;
        break;
      }
      case EntityTypeEnum.WORLD_FACT: {
        if (!state.worldFacts[entityId]) {
          state.worldFacts[entityId] = {
            id: entityId,
            category: 'general',
            fact: String(newValue),
            isRevoked: false,
          };
        }
        (state.worldFacts[entityId] as any)[property] = newValue;
        break;
      }
      case EntityTypeEnum.SECRET: {
        if (!state.mysteries[entityId]) {
          state.mysteries[entityId] = {
            id: entityId,
            description: entityId,
            truth: String(newValue),
            knownBy: [],
          };
        }
        (state.mysteries[entityId] as any)[property] = newValue;
        break;
      }
      case EntityTypeEnum.RELATIONSHIP: {
        if (!state.relationships[entityId]) {
          state.relationships[entityId] = {
            sourceId: entityId,
            targetId: '',
            type: 'unknown',
          };
        }
        (state.relationships[entityId] as any)[property] = newValue;
        break;
      }
      case EntityTypeEnum.TIMELINE: {
        (state.timeline as any)[entityId] = {
          event: property,
          chapter: delta.sourceChapterNumber ?? 0,
          isPublicKnowledge: false,
          ...((state.timeline as any)[entityId] ?? {}),
          [property]: newValue,
        };
        break;
      }
    }
  }

  // ====================================================================
  // Convert legacy StateChange[] from Prisma to StateDelta[]
  // ====================================================================
  static fromPrismaStateChanges(
    changes: Array<{
      entityType: string;
      entityId: string;
      property: string;
      previousValue: string | null;
      newValue: string;
      reason: string | null;
      scene?: { id: string; scenePlanVersion?: { chapter?: { number?: number } } } | null;
    }>
  ): StateDelta[] {
    return changes.map((c) => ({
      entityType: c.entityType as EntityTypeEnum,
      entityId: c.entityId,
      property: c.property,
      previousValue: c.previousValue,
      newValue: c.newValue,
      reason: c.reason ?? undefined,
      sourceSceneId: c.scene?.id,
      sourceChapterNumber: c.scene?.scenePlanVersion?.chapter?.number,
    }));
  }
}
