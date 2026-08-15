import { z } from 'zod';
import { BaseProvider } from './BaseProvider.js';
import { LLMMessage, LLMGenerationConfig } from '@ane/core';

export class MockProvider extends BaseProvider {
  protected providerName = 'Mock';

  async generateText(messages: LLMMessage[], config?: LLMGenerationConfig): Promise<string> {
    const combinedContent = messages.map(m => m.content).join('\n');
    return `Mock text response for: ${combinedContent.substring(0, 50)}...`;
  }

  async generateStructured<T>(messages: LLMMessage[], schema: z.ZodType<T>, config?: LLMGenerationConfig): Promise<T> {
    const combinedContent = messages.map(m => m.content).join('\n');
    
    // Architect Concepts
    if (combinedContent.includes('STAGE: CONCEPT')) {
      return {
        title: "Mock Title",
        hook: "Mock Hook",
        premise: "Mock Premise",
        genreCandidates: ["Fantasy"],
        toneCandidates: ["Dark"],
        targetAudience: "Adults",
        coreConflict: "Good vs Evil",
        uniqueSellingProposition: "Magic system"
      } as unknown as T;
    }

    if (combinedContent.includes('PLANNER_STAGE: DESTINATION')) {
      return {
        intendedEnding: "Defeat the dark lord",
        protagonistState: "King",
        antagonistState: "Dead",
        unresolvedQs: "None",
        thematicResolution: "Good wins",
        majorPayoffs: "Magic returns",
        turningPoints: "Finds sword",
        emotionalDest: "Peace"
      } as unknown as T;
    }

    if (combinedContent.includes('PLANNER_STAGE: MACRO')) {
      return {
        targetChapterCount: 100,
        numberOfSagas: 3,
        globalEscalation: "Things get worse",
        midpoint: "Huge battle",
        climax: "Final battle",
        ending: "Peace",
        sagas: [{ number: 1, title: "Beginning", purpose: "Introduce" }]
      } as unknown as T;
    }

    if (combinedContent.includes('PLANNER_STAGE: CHAPTER_BATCH')) {
      return { chapters: [] } as unknown as T;
    }

    if (combinedContent.includes('SCENE_STAGE: SCENE_PLAN')) {
      return { scenes: [] } as unknown as T;
    }

    if (combinedContent.includes('STAGE: PROSE_GENERATION') || combinedContent.includes('STAGE: PROSE_REVISION')) {
      return {
        content: "The cold wind whipped through the Capital streets as Character A ducked into the alleyway. Guards marched past, their armor clanking ominously. 'I have to find the king,' Character A muttered. The sewer grate was heavy, but with a surge of determined adrenaline, it gave way. The path to the castle was open.",
        wordCount: 152
      } as unknown as T;
    }

    // Default mock response
    return {} as T;
  }
}
