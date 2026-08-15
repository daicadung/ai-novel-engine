import { db } from '@ane/database';
import { 
  CausalEvent, 
  CausalEventType, 
  ImportanceLevel, 
  WorldTransitionType, 
  ConsequenceType, 
  ConsequenceStatus 
} from '@ane/core';

export class CausalityEngine {
  /**
   * Deterministically extract causal events from state deltas without an LLM.
   */
  static extractEventsFromDeltas(
    novelId: string,
    chapterNumber: number,
    sceneId: string | undefined,
    stateDeltas: any[]
  ): CausalEvent[] {
    const events: CausalEvent[] = [];

    for (const delta of stateDeltas) {
      let eventType = CausalEventType.STATE_CHANGE;
      let importance = ImportanceLevel.TRIVIAL;

      // Deterministic rule: Character Death
      if (delta.entityType === 'CHARACTER' && delta.property === 'status' && delta.newValue === 'DEAD') {
        eventType = CausalEventType.CHARACTER_DEATH;
        importance = ImportanceLevel.CRITICAL;
      }
      
      // Deterministic rule: Location destruction
      if (delta.entityType === 'LOCATION' && delta.property === 'status' && delta.newValue === 'DESTROYED') {
        eventType = CausalEventType.LOCATION_DESTROYED;
        importance = ImportanceLevel.MAJOR;
      }
      
      // Deterministic rule: Faction Defeated
      if (delta.entityType === 'FACTION' && delta.property === 'status' && delta.newValue === 'DEFEATED') {
        eventType = CausalEventType.FACTION_DEFEATED;
        importance = ImportanceLevel.MAJOR;
      }
      
      // Deterministic rule: Item Destroyed
      if (delta.entityType === 'ITEM' && delta.property === 'status' && delta.newValue === 'DESTROYED') {
        eventType = CausalEventType.ITEM_DESTROYED;
        importance = ImportanceLevel.SIGNIFICANT;
      }

      // We only care about SIGNIFICANT or higher by default to prevent graph explosion
      if (
        importance === ImportanceLevel.SIGNIFICANT ||
        importance === ImportanceLevel.MAJOR ||
        importance === ImportanceLevel.CRITICAL
      ) {
        events.push({
          id: `ce-${novelId}-${chapterNumber}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          novelId,
          chapterNumber,
          sceneId,
          eventType,
          actorIds: [], // Would need NLP or richer deltas to know exact actors
          targetIds: [delta.entityId],
          stateChanges: [delta],
          importance,
          provenance: `Derived deterministically from delta ${delta.entityType}:${delta.entityId}`,
          createdAt: new Date(),
        });
      }
    }

    return events;
  }

  /**
   * Derive deterministic world transitions and initial consequences from an event.
   * This is entirely rule-based and avoids LLM hallucinations.
   */
  static async deriveConsequences(event: CausalEvent): Promise<void> {
    if (event.importance === ImportanceLevel.TRIVIAL || event.importance === ImportanceLevel.MINOR) {
      return; // Skip low-level noise
    }

    const transitions = [];
    const consequences = [];

    if (event.eventType === CausalEventType.CHARACTER_DEATH) {
      for (const targetId of event.targetIds) {
        // Derive transition
        transitions.push({
          id: `wt-${Date.now()}-${targetId}`,
          novelId: event.novelId,
          entityId: targetId,
          transitionType: WorldTransitionType.GENERIC,
          beforeState: { status: 'ALIVE' },
          afterState: { status: 'DEAD' },
          causeEventId: event.id,
          chapterNumber: event.chapterNumber,
          reversible: false,
          provenance: 'Deterministic character death',
          createdAt: new Date(),
        });

        // Derive consequence
        consequences.push({
          id: `cq-${Date.now()}-${targetId}`,
          novelId: event.novelId,
          sourceEventId: event.id,
          consequenceType: ConsequenceType.RELATIONSHIP_CHANGE,
          targetEntityId: targetId, // Any relationships tied to this entity must change
          severity: 0.9,
          probability: 1.0, // Certain
          status: ConsequenceStatus.ACTIVE,
          description: `All alliances and enmities involving character ${targetId} are now moot or must transfer.`,
          provenance: 'Derived from CHARACTER_DEATH',
          createdAt: new Date(),
        });
      }
    } else if (event.eventType === CausalEventType.LOCATION_DESTROYED) {
      for (const targetId of event.targetIds) {
        transitions.push({
          id: `wt-${Date.now()}-${targetId}`,
          novelId: event.novelId,
          entityId: targetId,
          transitionType: WorldTransitionType.LOCATION_STATE_CHANGE,
          beforeState: { status: 'INTACT' },
          afterState: { status: 'DESTROYED' },
          causeEventId: event.id,
          chapterNumber: event.chapterNumber,
          reversible: false,
          provenance: 'Deterministic location destruction',
          createdAt: new Date(),
        });

        consequences.push({
          id: `cq-${Date.now()}-${targetId}`,
          novelId: event.novelId,
          sourceEventId: event.id,
          consequenceType: ConsequenceType.WORLD_CHANGE,
          targetEntityId: targetId,
          severity: 0.8,
          probability: 1.0,
          status: ConsequenceStatus.ACTIVE,
          description: `Location ${targetId} is no longer accessible for travel or shelter.`,
          provenance: 'Derived from LOCATION_DESTROYED',
          createdAt: new Date(),
        });
      }
    }

    // Batch insert transitions
    if (transitions.length > 0) {
      await db.worldTransitionRecord.createMany({
        data: transitions,
        skipDuplicates: true,
      });
    }

    // Batch insert consequences
    if (consequences.length > 0) {
      await db.consequenceRecord.createMany({
        data: consequences.map(c => ({
          ...c,
          expectedChapterRange: c.expectedChapterRange as any,
        })),
        skipDuplicates: true,
      });
    }
  }
}
