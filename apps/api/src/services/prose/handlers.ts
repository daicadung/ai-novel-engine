import { z } from 'zod';
import { GenerateSceneProseSchema } from '@ane/core';
import { LLMProvider } from '../architect/llm.js';
import { ProseValidator } from './validator.js';

export class ProseStageHandler {
  public provider: LLMProvider;
  
  constructor(provider: LLMProvider) {
    this.provider = provider;
  }
  
  async invokeWithRetries(
    contextPrompt: string, 
    scenePlan: any, 
    maxRetries: number = 3
  ): Promise<{ content: string, wordCount: number, validationReport: any, attempts: number }> {
    let attempts = 0;
    let lastContent = "";
    let lastWordCount = 0;
    let lastReport: any = null;

    while (attempts < maxRetries) {
      attempts++;
      
      const fullPrompt = attempts === 1 
        ? `${contextPrompt}\nSTAGE: PROSE_GENERATION`
        : `${contextPrompt}\nSTAGE: PROSE_REVISION\nPREVIOUS_FAILURES: ${JSON.stringify(lastReport?.failures)}`;

      const messages = [{ role: "user" as const, content: fullPrompt }];
      const draft = await this.provider.generateStructured(messages, GenerateSceneProseSchema);
      
      const report = ProseValidator.validateDraft(scenePlan, draft.content, draft.wordCount);
      lastContent = draft.content;
      lastWordCount = draft.wordCount;
      lastReport = report;

      if (report.passed) {
        return { content: draft.content, wordCount: draft.wordCount, validationReport: report, attempts };
      }
    }

    return { content: lastContent, wordCount: lastWordCount, validationReport: lastReport, attempts };
  }
}
