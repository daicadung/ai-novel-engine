import { z } from 'zod';
import { BaseProvider } from './BaseProvider.js';
import { LLMMessage, LLMGenerationConfig, LLMErrorCode } from '@ane/core';

export class MockProvider extends BaseProvider {
  protected providerName = 'Mock';

  async generateText(messages: LLMMessage[], config?: LLMGenerationConfig): Promise<string> {
    const combinedContent = messages.map(m => m.content).join('\n');
    
    if (config?.onUsage) {
      config.onUsage({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
    }
    
    return `Mock text response for: ${combinedContent.substring(0, 50)}...`;
  }

  async generateStructured<T>(messages: LLMMessage[], schema: z.ZodType<T>, config?: LLMGenerationConfig): Promise<T> {
    const combinedContent = messages.map(m => m.content).join('\n');
    
    if (config?.onUsage) {
      config.onUsage({ inputTokens: 100, outputTokens: 200, totalTokens: 300 });
    }
    
    // Default mock response
    let data = {} as any;
    if (combinedContent.includes('STAGE: CONCEPT')) {
      data = {
        title: "Mock Title",
        hook: "Mock Hook",
        premise: "Mock Premise",
        genreCandidates: ["Fantasy"],
        toneCandidates: ["Dark"],
        targetAudience: "Adults",
        coreConflict: "Good vs Evil",
        uniqueSellingProposition: "Magic system"
      };
    }

    if (combinedContent.includes('PLANNER_STAGE: DESTINATION')) {
      data = {
        intendedEnding: "Defeat the dark lord",
        protagonistState: "King",
        antagonistState: "Dead",
        unresolvedQs: "None",
        thematicResolution: "Good wins",
        majorPayoffs: "Magic returns",
        turningPoints: "Finds sword",
        emotionalDest: "Peace"
      };
    }

    if (combinedContent.includes('PLANNER_STAGE: MACRO')) {
      data = {
        targetChapterCount: 100,
        numberOfSagas: 3,
        globalEscalation: "Things get worse",
        midpoint: "Huge battle",
        climax: "Final battle",
        ending: "Peace",
        sagas: [{ number: 1, title: "Beginning", purpose: "Introduce" }]
      };
    }

    if (combinedContent.includes('PLANNER_STAGE: CHAPTER_BATCH')) {
      data = { chapters: [] };
    }

    if (combinedContent.includes('SCENE_STAGE: SCENE_PLAN')) {
      data = { scenes: [] };
    }

    if (combinedContent.includes('STAGE: PROSE_GENERATION') || combinedContent.includes('STAGE: PROSE_REVISION')) {
      data = {
        content: "The cold wind whipped through the Capital streets as Character A ducked into the alleyway. Guards marched past, their armor clanking ominously. 'I have to find the king,' Character A muttered. The sewer grate was heavy, but with a surge of determined adrenaline, it gave way. The path to the castle was open.",
        wordCount: 152
      };
    }

    // Explicitly for tests that return bad data or need validation
    if (combinedContent.includes('test')) {
      try {
        const textData = await this.generateText(messages);
        data = JSON.parse(textData);
      } catch {
        throw this.createError(LLMErrorCode.INVALID_RESPONSE, 'Malformed JSON', false);
      }
    }
    
    const validationResult = schema.safeParse(data);
    if (!validationResult.success) {
      throw this.createError(LLMErrorCode.INVALID_RESPONSE, `Zod validation failed: ${validationResult.error.message}`, false, undefined, validationResult.error);
    }
    
    return validationResult.data;
  }
}
