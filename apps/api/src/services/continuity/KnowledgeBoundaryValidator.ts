import {
  KnowledgeState,
  Secret,
  StoryState,
  ContinuityConflict,
  ContinuityConflictType,
  ConflictSeverity,
} from '@ane/core';

/**
 * KnowledgeBoundaryValidator
 *
 * Enforces that POV-character scenes only use information that character knows.
 *
 * GLOBAL TRUTH vs CHARACTER KNOWLEDGE:
 *   - GLOBAL TRUTH: what is objectively true in the story world
 *   - CHARACTER KNOWLEDGE: what a specific POV character knows/believes
 *
 * This service is pure — no DB access.
 */
export class KnowledgeBoundaryValidator {
  // ====================================================================
  // Build a POV-filtered StoryState for a specific character
  // ====================================================================
  static buildPOVState(
    globalState: StoryState,
    characterKnowledge: KnowledgeState,
    currentChapter: number
  ): Partial<StoryState> {
    const characterId = characterKnowledge.characterId;

    // Filter characters to only those this POV knows
    const knownCharacters: Record<string, any> = {};
    for (const [id, char] of Object.entries(globalState.characters)) {
      if (
        id === characterId ||
        characterKnowledge.knownEntities[id] !== undefined
      ) {
        knownCharacters[id] = { ...char };

        // Apply character's BELIEFS over global truth
        const beliefs = characterKnowledge.knownEntities[id]?.beliefs;
        if (beliefs) {
          for (const [prop, belief] of Object.entries(beliefs)) {
            knownCharacters[id][prop] = belief;
          }
        }
      }
    }

    // Filter mysteries to only those the character knows
    const knownMysteries: Record<string, any> = {};
    for (const secretId of characterKnowledge.knownSecrets) {
      if (globalState.mysteries[secretId]) {
        knownMysteries[secretId] = globalState.mysteries[secretId];
      }
    }

    // Filter secrets revealed before or at the POV character's knowledge cutoff
    const filteredMysteries: Record<string, any> = {};
    for (const [id, secret] of Object.entries(globalState.mysteries)) {
      const knownByChar = (secret as Secret).knownBy.includes(characterId);
      const revealedBefore =
        !secret.revealedInChapter || secret.revealedInChapter <= currentChapter;
      if (knownByChar && revealedBefore) {
        filteredMysteries[id] = secret;
      }
    }

    return {
      novelId: globalState.novelId,
      asOfChapter: currentChapter,
      characters: knownCharacters,
      locations: globalState.locations, // locations are generally public knowledge
      items: globalState.items,
      factions: globalState.factions,
      mysteries: { ...knownMysteries, ...filteredMysteries },
      quests: globalState.quests,
      worldFacts: globalState.worldFacts,
      // Redact global truth for relationships the character doesn't know
      relationships: this.filterRelationships(globalState, characterKnowledge),
    };
  }

  // ====================================================================
  // Detect knowledge leakage in generated prose
  // ====================================================================
  static detectKnowledgeLeak(
    proseText: string,
    globalState: StoryState,
    characterKnowledge: KnowledgeState,
    currentChapter: number
  ): ContinuityConflict[] {
    const conflicts: ContinuityConflict[] = [];

    // Check for secrets the POV character shouldn't know
    for (const [secretId, secret] of Object.entries(globalState.mysteries)) {
      const charKnows = (secret as Secret).knownBy.includes(characterKnowledge.characterId);
      const notYetRevealed =
        secret.revealedInChapter !== undefined &&
        secret.revealedInChapter > currentChapter;

      if (!charKnows && notYetRevealed) {
        // Simple heuristic: check if secret truth words appear in prose
        const truthWords = secret.truth.toLowerCase().split(' ').filter((w) => w.length > 4);
        const proseWords = proseText.toLowerCase();
        const leaks = truthWords.filter((w) => proseWords.includes(w));

        if (leaks.length >= 2) {

          conflicts.push({
            type: ContinuityConflictType.KNOWLEDGE_LEAK,
            severity: ConflictSeverity.WARNING,
            entityId: secretId,
            entityType: 'SECRET',
            description: `POV character "${characterKnowledge.characterName}" appears to know secret "${secret.description}" which is not yet revealed (chapter ${secret.revealedInChapter})`,
            chapterNumber: currentChapter,
          });
        }
      }
    }

    // Check for characters the POV shouldn't know are alive/dead
    for (const [charId, char] of Object.entries(globalState.characters)) {
      if (charId === characterKnowledge.characterId) continue;
      if (characterKnowledge.knownEntities[charId] !== undefined) continue;

      // Character is not known to POV — shouldn't appear in prose with intimate details
      const charNameWords = char.name.toLowerCase().split(' ');
      const appearsInProse = charNameWords.some((n) =>
        n.length > 3 && proseText.toLowerCase().includes(n)
      );

      if (appearsInProse) {
        // This is a WARNING not ERROR — could be a new introduction
        conflicts.push({
          type: ContinuityConflictType.KNOWLEDGE_LEAK,
          severity: ConflictSeverity.INFO,
          entityId: charId,
          entityType: 'CHARACTER',
          description: `Character "${char.name}" mentioned but POV character "${characterKnowledge.characterName}" may not know them yet`,
          chapterNumber: currentChapter,
        });
      }
    }

    return conflicts;
  }

  // ====================================================================
  // Validate revelation timing
  // ====================================================================
  static validateRevealTiming(
    secrets: Secret[],
    currentChapter: number
  ): ContinuityConflict[] {
    const conflicts: ContinuityConflict[] = [];
    const seen = new Set<string>();

    for (const secret of secrets) {
      // Check for duplicate revelations
      const key = `${secret.id}:${secret.revealedInChapter}`;
      if (seen.has(key)) {
        conflicts.push({
          type: ContinuityConflictType.DUPLICATE_REVELATION,
          severity: ConflictSeverity.WARNING,
          entityId: secret.id,
          entityType: 'SECRET',
          description: `Secret "${secret.description}" appears to be revealed multiple times at chapter ${secret.revealedInChapter}`,
          chapterNumber: currentChapter,
        });
      }
      seen.add(key);
    }

    return conflicts;
  }

  // ====================================================================
  // Build empty KnowledgeState for a character
  // ====================================================================
  static buildEmptyKnowledge(characterId: string, characterName: string): KnowledgeState {
    return {
      characterId,
      characterName,
      knownFacts: [],
      knownEntities: {},
      knownSecrets: [],
      beliefs: {},
      misconceptions: [],
      discoveredAtChapter: {},
      lastUpdatedChapter: 0,
    };
  }

  // ====================================================================
  // Update knowledge state when a secret is revealed to a character
  // ====================================================================
  static revealSecret(
    knowledge: KnowledgeState,
    secretId: string,
    chapterNumber: number
  ): KnowledgeState {
    if (knowledge.knownSecrets.includes(secretId)) return knowledge;

    return {
      ...knowledge,
      knownSecrets: [...knowledge.knownSecrets, secretId],
      discoveredAtChapter: {
        ...knowledge.discoveredAtChapter,
        [secretId]: chapterNumber,
      },
      lastUpdatedChapter: chapterNumber,
    };
  }

  // ====================================================================
  // Private helpers
  // ====================================================================
  private static filterRelationships(
    globalState: StoryState,
    knowledge: KnowledgeState
  ): Record<string, any> {
    const filtered: Record<string, any> = {};
    for (const [id, rel] of Object.entries(globalState.relationships)) {
      const knowsSource = knowledge.knownEntities[rel.sourceId] !== undefined;
      const knowsTarget = knowledge.knownEntities[rel.targetId] !== undefined;
      if (knowsSource || knowsTarget) {
        filtered[id] = rel;
      }
    }
    return filtered;
  }
}
