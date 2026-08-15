import { z } from 'zod';
import { ArchitectStage, STAGE_REGISTRY, StageDefinition } from '@ane/core';
import { LLMProvider } from './llm.js';
import { db } from '@ane/database';

export abstract class StageHandler<T extends z.ZodTypeAny> {
  public provider: LLMProvider;
  public definition: StageDefinition;
  
  constructor(provider: LLMProvider, definition: StageDefinition) {
    this.provider = provider;
    this.definition = definition;
  }

  abstract prepareInput(novelId: string): Promise<string>;
  
  async invoke(contextPrompt: string, config?: any): Promise<z.infer<T>> {
    const messages = [{ role: "user" as const, content: contextPrompt }];
    const data = await this.provider.generateStructured(messages, this.definition.outputSchema, config);
    return data as z.infer<T>;
  }

  abstract applyCanonicalPersistence(novelId: string, data: z.infer<T>, tx: any): Promise<void>;
}

export class ConceptStageHandler extends StageHandler<typeof STAGE_REGISTRY.CONCEPT.outputSchema> {
  constructor(provider: LLMProvider) { super(provider, STAGE_REGISTRY.CONCEPT); }
  async prepareInput(novelId: string) {
    const novel = await db.novel.findUnique({ where: { id: novelId } });
    return `Generate concept for novel titled: ${novel?.title}`;
  }
  async applyCanonicalPersistence(novelId: string, data: any, tx: any) {
    await tx.novel.update({ where: { id: novelId }, data: { premise: data.premise } });
  }
}

export class PremiseStageHandler extends StageHandler<typeof STAGE_REGISTRY.PREMISE.outputSchema> {
  constructor(provider: LLMProvider) { super(provider, STAGE_REGISTRY.PREMISE); }
  async prepareInput(novelId: string) { return `Generate premise for ${novelId}`; }
  async applyCanonicalPersistence(novelId: string, data: any, tx: any) {
    await tx.novel.update({ where: { id: novelId }, data: { premise: data.extendedPremise } });
  }
}

export class GenreToneStageHandler extends StageHandler<typeof STAGE_REGISTRY.GENRE_AND_TONE.outputSchema> {
  constructor(provider: LLMProvider) { super(provider, STAGE_REGISTRY.GENRE_AND_TONE); }
  async prepareInput(novelId: string) { return `Generate genre/tone for ${novelId}`; }
  async applyCanonicalPersistence(novelId: string, data: any, tx: any) {
    await tx.novel.update({ where: { id: novelId }, data: { genre: data.genre.primary, tone: data.tone.primary } });
  }
}

export class ThemesStageHandler extends StageHandler<typeof STAGE_REGISTRY.THEMES.outputSchema> {
  constructor(provider: LLMProvider) { super(provider, STAGE_REGISTRY.THEMES); }
  async prepareInput(novelId: string) { return `Generate themes for ${novelId}`; }
  async applyCanonicalPersistence(novelId: string, data: any, tx: any) {}
}

export class WorldStageHandler extends StageHandler<typeof STAGE_REGISTRY.WORLD.outputSchema> {
  constructor(provider: LLMProvider) { super(provider, STAGE_REGISTRY.WORLD); }
  async prepareInput(novelId: string) { return `Generate world for ${novelId}`; }
  async applyCanonicalPersistence(novelId: string, data: any, tx: any) {
    for (const loc of data.locations) {
      const existing = await tx.location.findFirst({ where: { novelId, name: loc.name } });
      if (existing) {
        await tx.location.update({ where: { id: existing.id }, data: { description: loc.description } });
      } else {
        await tx.location.create({ data: { novelId, name: loc.name, description: loc.description } });
      }
    }
  }
}

export class PowerSystemStageHandler extends StageHandler<typeof STAGE_REGISTRY.POWER_SYSTEM.outputSchema> {
  constructor(provider: LLMProvider) { super(provider, STAGE_REGISTRY.POWER_SYSTEM); }
  async prepareInput(novelId: string) { return `Generate power system for ${novelId}`; }
  async applyCanonicalPersistence(novelId: string, data: any, tx: any) {}
}

export class CharactersStageHandler extends StageHandler<typeof STAGE_REGISTRY.CHARACTERS.outputSchema> {
  constructor(provider: LLMProvider) { super(provider, STAGE_REGISTRY.CHARACTERS); }
  async prepareInput(novelId: string) { return `Generate characters for ${novelId}`; }
  async applyCanonicalPersistence(novelId: string, data: any, tx: any) {
    for (const char of data.characters) {
      const existing = await tx.character.findFirst({ where: { novelId, name: char.name } });
      if (existing) {
        await tx.character.update({
          where: { id: existing.id },
          data: { role: char.role, personality: char.personality, background: char.backstory, goals: char.goals }
        });
      } else {
        await tx.character.create({
          data: { novelId, name: char.name, role: char.role, personality: char.personality, background: char.backstory, goals: char.goals }
        });
      }
    }
  }
}

export class FactionsStageHandler extends StageHandler<typeof STAGE_REGISTRY.FACTIONS.outputSchema> {
  constructor(provider: LLMProvider) { super(provider, STAGE_REGISTRY.FACTIONS); }
  async prepareInput(novelId: string) { return `Generate factions for ${novelId}`; }
  async applyCanonicalPersistence(novelId: string, data: any, tx: any) {
    for (const f of data.factions) {
      const existing = await tx.faction.findFirst({ where: { novelId, name: f.name } });
      if (existing) {
        await tx.faction.update({ where: { id: existing.id }, data: { description: f.goals } });
      } else {
        await tx.faction.create({ data: { novelId, name: f.name, description: f.goals } });
      }
    }
  }
}

export class ConflictsStageHandler extends StageHandler<typeof STAGE_REGISTRY.CONFLICTS.outputSchema> {
  constructor(provider: LLMProvider) { super(provider, STAGE_REGISTRY.CONFLICTS); }
  async prepareInput(novelId: string) { return `Generate conflicts for ${novelId}`; }
  async applyCanonicalPersistence(novelId: string, data: any, tx: any) {}
}

export class PlotThreadsStageHandler extends StageHandler<typeof STAGE_REGISTRY.PLOT_THREADS.outputSchema> {
  constructor(provider: LLMProvider) { super(provider, STAGE_REGISTRY.PLOT_THREADS); }
  async prepareInput(novelId: string) { return `Generate plot threads for ${novelId}`; }
  async applyCanonicalPersistence(novelId: string, data: any, tx: any) {
    for (const t of data.threads) {
      const existing = await tx.plotThread.findFirst({ where: { novelId, title: t.title } });
      if (existing) {
        await tx.plotThread.update({ where: { id: existing.id }, data: { description: t.description } });
      } else {
        await tx.plotThread.create({ data: { novelId, title: t.title, description: t.description, status: 'OPEN' } });
      }
    }
  }
}

export class CharacterArcsStageHandler extends StageHandler<typeof STAGE_REGISTRY.CHARACTER_ARCS.outputSchema> {
  constructor(provider: LLMProvider) { super(provider, STAGE_REGISTRY.CHARACTER_ARCS); }
  async prepareInput(novelId: string) { return `Generate character arcs for ${novelId}`; }
  async applyCanonicalPersistence(novelId: string, data: any, tx: any) {}
}

export class ForeshadowingStageHandler extends StageHandler<typeof STAGE_REGISTRY.FORESHADOWING.outputSchema> {
  constructor(provider: LLMProvider) { super(provider, STAGE_REGISTRY.FORESHADOWING); }
  async prepareInput(novelId: string) { return `Generate foreshadowing for ${novelId}`; }
  async applyCanonicalPersistence(novelId: string, data: any, tx: any) {
    for (const h of data.hints) {
      // Foreshadowing doesn't have a strict name, use description as key or just append
      // Since it's hints, we can just append if we don't have a stable key, but to be idempotent:
      const existing = await tx.foreshadowing.findFirst({ where: { novelId, description: h.setup } });
      if (!existing) {
        await tx.foreshadowing.create({ data: { novelId, description: h.setup } });
      }
    }
  }
}

export class LongTermStructureStageHandler extends StageHandler<typeof STAGE_REGISTRY.LONG_TERM_STRUCTURE.outputSchema> {
  constructor(provider: LLMProvider) { super(provider, STAGE_REGISTRY.LONG_TERM_STRUCTURE); }
  async prepareInput(novelId: string) { return `Generate structure for ${novelId}`; }
  async applyCanonicalPersistence(novelId: string, data: any, tx: any) {}
}

export class StoryBibleFinalizationStageHandler extends StageHandler<typeof STAGE_REGISTRY.STORY_BIBLE_FINALIZATION.outputSchema> {
  constructor(provider: LLMProvider) { super(provider, STAGE_REGISTRY.STORY_BIBLE_FINALIZATION); }
  async prepareInput(novelId: string) { return `Finalize Story Bible for ${novelId}`; }
  async applyCanonicalPersistence(novelId: string, data: any, tx: any) {
    const last = await tx.storyBible.findFirst({ where: { novelId }, orderBy: { version: 'desc' } });
    const version = last ? last.version + 1 : 1;
    await tx.storyBible.create({
      data: {
        novelId,
        version,
        logline: data.logline,
        synopsis: data.synopsis,
        isCanonical: true
      }
    });
  }
}
