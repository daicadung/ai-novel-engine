import {
  StoryState,
  StateDelta,
  ContinuityConflict,
  ContinuityConflictType,
  ConflictSeverity,
  ContinuityValidationReport,
  EntityTypeEnum,
} from '@ane/core';

/**
 * LongTermContinuityValidator
 *
 * Validates a proposed chapter/scene against the canonical StoryState.
 * Returns a structured ContinuityValidationReport.
 *
 * PURE service — no DB access. Call with pre-fetched state.
 * All checks are deterministic.
 */
export class LongTermContinuityValidator {
  // ====================================================================
  // Master validation entry point
  // ====================================================================
  static validate(
    currentState: StoryState,
    proposedDeltas: StateDelta[],
    chapterNumber: number,
    options: {
      proseText?: string;
      sceneId?: string;
      chapterId?: string;
      participatingCharacters?: string[];
    } = {}
  ): ContinuityValidationReport {
    const conflicts: ContinuityConflict[] = [];

    // Run all checks
    conflicts.push(
      ...this.checkDeadCharacters(currentState, proposedDeltas, options.proseText),
      ...this.checkImpossibleLocation(currentState, proposedDeltas),
      ...this.checkImpossiblePossession(currentState, proposedDeltas),
      ...this.checkMissingInjuryConsequences(currentState, proposedDeltas, chapterNumber),
      ...this.checkRelationshipContradiction(currentState, proposedDeltas),
      ...this.checkTimelineContradiction(currentState, proposedDeltas, chapterNumber),
      ...this.checkImpossibleAbility(currentState, proposedDeltas),
      ...this.checkStateCollision(proposedDeltas),
      ...this.checkWorldStateTransition(currentState, proposedDeltas),
    );

    // Compute status
    const errors = conflicts.filter((c) => c.severity === ConflictSeverity.ERROR);
    const warnings = conflicts.filter((c) => c.severity === ConflictSeverity.WARNING);

    const status: 'PASS' | 'WARN' | 'FAIL' =
      errors.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS';

    const maxSeverity =
      errors.length > 0
        ? ConflictSeverity.ERROR
        : warnings.length > 0
        ? ConflictSeverity.WARNING
        : ConflictSeverity.INFO;

    return {
      status,
      severity: maxSeverity,
      conflicts,
      checkedAt: new Date(),
      chapterId: options.chapterId,
      sceneId: options.sceneId,
    };
  }

  // ====================================================================
  // Check: dead characters appearing
  // ====================================================================
  static checkDeadCharacters(
    state: StoryState,
    deltas: StateDelta[],
    proseText?: string
  ): ContinuityConflict[] {
    const conflicts: ContinuityConflict[] = [];

    // Check deltas that operate on dead characters
    for (const delta of deltas) {
      if (delta.entityType !== EntityTypeEnum.CHARACTER) continue;

      const char = state.characters[delta.entityId];
      if (!char) continue;

      if (!char.isAlive && delta.property !== 'isAlive') {
        // Operating on a dead character (unless resurrecting them)
        conflicts.push({
          type: ContinuityConflictType.DEAD_CHARACTER,
          severity: ConflictSeverity.ERROR,
          entityId: delta.entityId,
          entityType: 'CHARACTER',
          description: `State change applied to dead character "${char.name}" (property: ${delta.property})`,
          chapterNumber: delta.sourceChapterNumber,
        });
      }
    }

    // Check prose for dead character names
    if (proseText) {
      for (const [id, char] of Object.entries(state.characters)) {
        if (!char.isAlive) {
          const nameInProse = proseText.toLowerCase().includes(char.name.toLowerCase());
          if (nameInProse) {
            // WARNING only — could be a memory/reference
            conflicts.push({
              type: ContinuityConflictType.DEAD_CHARACTER,
              severity: ConflictSeverity.INFO,
              entityId: id,
              entityType: 'CHARACTER',
              description: `Dead character "${char.name}" is mentioned in prose — verify this is a memory/reference, not a physical appearance`,
              resolution: 'Ensure this is historical reference, not physical presence',
            });
          }
        }
      }
    }

    return conflicts;
  }

  // ====================================================================
  // Check: impossible location transitions
  // ====================================================================
  static checkImpossibleLocation(
    state: StoryState,
    deltas: StateDelta[]
  ): ContinuityConflict[] {
    const conflicts: ContinuityConflict[] = [];

    for (const delta of deltas) {
      if (delta.entityType !== EntityTypeEnum.CHARACTER) continue;
      if (delta.property !== 'location') continue;

      const char = state.characters[delta.entityId];
      if (!char) continue;

      const newLocation = String(delta.newValue);
      const loc = Object.values(state.locations).find(
        (l) => l.name.toLowerCase() === newLocation.toLowerCase()
      );

      // Check if location is inaccessible
      if (loc && !loc.isAccessible) {
        conflicts.push({
          type: ContinuityConflictType.IMPOSSIBLE_LOCATION,
          severity: ConflictSeverity.ERROR,
          entityId: delta.entityId,
          entityType: 'CHARACTER',
          description: `Character "${char.name}" moves to inaccessible location "${newLocation}"`,
          chapterNumber: delta.sourceChapterNumber,
          resolution: 'Either make location accessible first or change destination',
        });
      }
    }

    return conflicts;
  }

  // ====================================================================
  // Check: impossible possession
  // ====================================================================
  static checkImpossiblePossession(
    state: StoryState,
    deltas: StateDelta[]
  ): ContinuityConflict[] {
    const conflicts: ContinuityConflict[] = [];

    for (const delta of deltas) {
      if (delta.entityType !== EntityTypeEnum.ITEM) continue;
      if (delta.property !== 'ownerId') continue;

      const item = state.items[delta.entityId];
      if (!item) continue;

      // Item is destroyed — can't be possessed
      if (item.isDestroyed) {
        conflicts.push({
          type: ContinuityConflictType.IMPOSSIBLE_POSSESSION,
          severity: ConflictSeverity.ERROR,
          entityId: delta.entityId,
          entityType: 'ITEM',
          description: `Cannot transfer ownership of destroyed item "${item.name}"`,
          chapterNumber: delta.sourceChapterNumber,
        });
        continue;
      }

      // Item already owned by someone else — should be handled (trade/theft/gift)
      if (item.ownerId && item.ownerId !== String(delta.newValue)) {
        const oldOwner = state.characters[item.ownerId];
        if (oldOwner?.isAlive) {
          // Just a warning — could be theft, trade, etc.
          conflicts.push({
            type: ContinuityConflictType.IMPOSSIBLE_POSSESSION,
            severity: ConflictSeverity.WARNING,
            entityId: delta.entityId,
            entityType: 'ITEM',
            description: `Item "${item.name}" changing owner from "${oldOwner.name}" to "${delta.newValue}" without explicit transfer scene`,
            chapterNumber: delta.sourceChapterNumber,
            resolution: 'Add a transfer scene or mark as stolen/gifted',
          });
        }
      }
    }

    return conflicts;
  }

  // ====================================================================
  // Check: missing injury consequences
  // ====================================================================
  static checkMissingInjuryConsequences(
    state: StoryState,
    deltas: StateDelta[],
    chapterNumber: number
  ): ContinuityConflict[] {
    const conflicts: ContinuityConflict[] = [];

    for (const [charId, char] of Object.entries(state.characters)) {
      if (!char.physicalState || Object.keys(char.physicalState).length === 0) continue;

      // Check if the character is mentioned as using abilities despite injuries
      const relevantDelta = deltas.find(
        (d) =>
          d.entityType === EntityTypeEnum.CHARACTER &&
          d.entityId === charId &&
          d.property === 'abilities'
      );

      if (relevantDelta && char.physicalState) {
        const injuries = Object.entries(char.physicalState)
          .filter(([_, v]) => v && String(v).includes('injury'))
          .map(([k]) => k);

        if (injuries.length > 0) {
          // INFO — may be valid to use other abilities
          conflicts.push({
            type: ContinuityConflictType.MISSING_INJURY,
            severity: ConflictSeverity.INFO,
            entityId: charId,
            entityType: 'CHARACTER',
            description: `Character "${char.name}" uses abilities despite having injuries: ${injuries.join(', ')}`,
            chapterNumber,
          });
        }
      }
    }

    return conflicts;
  }

  // ====================================================================
  // Check: relationship contradictions
  // ====================================================================
  static checkRelationshipContradiction(
    state: StoryState,
    deltas: StateDelta[]
  ): ContinuityConflict[] {
    const conflicts: ContinuityConflict[] = [];

    for (const delta of deltas) {
      if (delta.entityType !== EntityTypeEnum.RELATIONSHIP) continue;
      if (delta.property !== 'type') continue;

      const existing = state.relationships[delta.entityId];
      if (!existing) continue;

      // Check for extreme reversals (e.g., ALLIED → ENEMY in same chapter)
      const isExtremeReversal =
        (existing.type === 'ALLIED' && delta.newValue === 'ENEMY') ||
        (existing.type === 'ENEMY' && delta.newValue === 'ALLIED') ||
        (existing.type === 'LOVE' && delta.newValue === 'HATE');

      if (isExtremeReversal) {
        conflicts.push({
          type: ContinuityConflictType.RELATIONSHIP_CONTRADICTION,
          severity: ConflictSeverity.WARNING,
          entityId: delta.entityId,
          entityType: 'RELATIONSHIP',
          description: `Relationship "${delta.entityId}" changed from "${existing.type}" to "${delta.newValue}" — extreme reversal should be foreshadowed`,
          chapterNumber: delta.sourceChapterNumber,
        });
      }
    }

    return conflicts;
  }

  // ====================================================================
  // Check: timeline contradictions
  // ====================================================================
  static checkTimelineContradiction(
    state: StoryState,
    deltas: StateDelta[],
    currentChapter: number
  ): ContinuityConflict[] {
    const conflicts: ContinuityConflict[] = [];

    for (const delta of deltas) {
      if (delta.entityType !== EntityTypeEnum.TIMELINE) continue;

      const existingEvent = state.timeline[delta.entityId];
      if (!existingEvent) continue;

      // Check if an event is being re-placed in a different chapter
      if (existingEvent.chapter !== currentChapter && existingEvent.chapter > 0) {
        conflicts.push({
          type: ContinuityConflictType.TIMELINE_CONTRADICTION,
          severity: ConflictSeverity.WARNING,
          entityId: delta.entityId,
          entityType: 'TIMELINE',
          description: `Timeline event "${delta.entityId}" already placed at chapter ${existingEvent.chapter}, now being modified at chapter ${currentChapter}`,
          chapterNumber: currentChapter,
        });
      }
    }

    return conflicts;
  }

  // ====================================================================
  // Check: impossible ability usage
  // ====================================================================
  static checkImpossibleAbility(
    state: StoryState,
    deltas: StateDelta[]
  ): ContinuityConflict[] {
    const conflicts: ContinuityConflict[] = [];

    for (const delta of deltas) {
      if (delta.entityType !== EntityTypeEnum.ABILITY) continue;

      const ownerId = delta.entityId.split(':')[0];
      const char = state.characters[ownerId];
      if (!char) continue;

      // Character is dead — can't use abilities
      if (!char.isAlive) {
        conflicts.push({
          type: ContinuityConflictType.IMPOSSIBLE_ABILITY,
          severity: ConflictSeverity.ERROR,
          entityId: delta.entityId,
          entityType: 'ABILITY',
          description: `Dead character "${char.name}" uses ability "${delta.property}"`,
          chapterNumber: delta.sourceChapterNumber,
        });
      }
    }

    return conflicts;
  }

  // ====================================================================
  // Check: state change collisions (two conflicting changes to same property)
  // ====================================================================
  static checkStateCollision(deltas: StateDelta[]): ContinuityConflict[] {
    const conflicts: ContinuityConflict[] = [];
    const seen = new Map<string, StateDelta>();

    for (const delta of deltas) {
      const key = `${delta.entityType}:${delta.entityId}:${delta.property}`;
      const existing = seen.get(key);
      if (existing) {
        if (existing.newValue !== delta.newValue) {
          conflicts.push({
            type: ContinuityConflictType.STATE_COLLISION,
            severity: ConflictSeverity.ERROR,
            entityId: delta.entityId,
            entityType: delta.entityType,
            description: `Conflicting state changes for ${delta.entityType} "${delta.entityId}" property "${delta.property}": "${existing.newValue}" vs "${delta.newValue}"`,
            chapterNumber: delta.sourceChapterNumber,
          });
        }
      } else {
        seen.set(key, delta);
      }
    }

    return conflicts;
  }

  // ====================================================================
  // Check: impossible world state transitions
  // ====================================================================
  static checkWorldStateTransition(
    state: StoryState,
    deltas: StateDelta[]
  ): ContinuityConflict[] {
    const conflicts: ContinuityConflict[] = [];

    for (const delta of deltas) {
      if (delta.entityType !== EntityTypeEnum.WORLD_FACT) continue;

      const existing = state.worldFacts[delta.entityId];
      if (!existing || existing.isRevoked) continue;

      // Revoking a world fact that has never been established
      if (delta.property === 'isRevoked' && delta.newValue === true && !existing.fact) {
        conflicts.push({
          type: ContinuityConflictType.IMPOSSIBLE_WORLD_STATE,
          severity: ConflictSeverity.WARNING,
          entityId: delta.entityId,
          entityType: 'WORLD_FACT',
          description: `Attempting to revoke unestablished world fact "${delta.entityId}"`,
          chapterNumber: delta.sourceChapterNumber,
        });
      }
    }

    return conflicts;
  }

  // ====================================================================
  // Dependency-aware invalidation: identify what content depends on changed state
  // ====================================================================
  static findDependentChapters(
    deltas: StateDelta[],
    chapterMemories: Array<{
      chapterNumber: number;
      chapterId: string;
      stateDeltas: StateDelta[];
    }>,
    fromChapter: number
  ): Array<{ chapterId: string; chapterNumber: number; reason: string }> {
    const dependents: Array<{ chapterId: string; chapterNumber: number; reason: string }> = [];
    const changedKeys = new Set(
      deltas.map((d) => `${d.entityType}:${d.entityId}:${d.property}`)
    );

    for (const memory of chapterMemories) {
      if (memory.chapterNumber <= fromChapter) continue;

      // Check if this chapter's state deltas DEPEND on what we just changed
      for (const memDelta of memory.stateDeltas) {
        const prevKey = `${memDelta.entityType}:${memDelta.entityId}:${memDelta.property}`;
        if (changedKeys.has(prevKey)) {
          dependents.push({
            chapterId: memory.chapterId,
            chapterNumber: memory.chapterNumber,
            reason: `Depends on state change to ${memDelta.entityType}:${memDelta.entityId}`,
          });
          break;
        }
      }
    }

    return dependents;
  }
}
