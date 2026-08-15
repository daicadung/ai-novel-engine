import { BudgetConfig, GenerationUsage, BudgetExceededError } from '@ane/core';

// In a real app, this would be stored in the DB.
// For DB-free testing and simplicity in this phase, we keep track in memory.
export class BudgetManager {
  private static instance: BudgetManager;
  private currentConfig: BudgetConfig = {};
  
  // In-memory usage stores
  private novelUsage: Map<string, number> = new Map(); // novelId -> cost
  private chapterUsage: Map<string, number> = new Map(); // chapterId -> cost
  private jobUsage: Map<string, number> = new Map(); // jobId -> cost
  private dailyProviderUsage: Map<string, number> = new Map(); // provider_date -> cost
  private tokenUsage: number = 0;

  private constructor() {}

  static getInstance(): BudgetManager {
    if (!BudgetManager.instance) {
      BudgetManager.instance = new BudgetManager();
    }
    return BudgetManager.instance;
  }

  setConfig(config: BudgetConfig) {
    this.currentConfig = { ...this.currentConfig, ...config };
  }

  resetMemoryStore() {
    this.novelUsage.clear();
    this.chapterUsage.clear();
    this.jobUsage.clear();
    this.dailyProviderUsage.clear();
    this.tokenUsage = 0;
  }

  calculateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
    // Basic mock pricing in USD per 1k tokens
    const pricing: Record<string, { input: number, output: number }> = {
      'OpenAIProvider:gpt-4o': { input: 0.005, output: 0.015 },
      'OpenAIProvider:gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
      'AnthropicProvider:claude-3-opus': { input: 0.015, output: 0.075 },
      'MockProvider:mock': { input: 0, output: 0 } // Mock is free
    };

    const key = `${provider}:${model}`;
    const rate = pricing[key] || { input: 0.01, output: 0.03 }; // fallback

    return (inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output;
  }

  checkPreFlightBudget(novelId: string, chapterId?: string, jobId?: string): void {
    if (this.currentConfig.maxNovelCostUsd !== undefined) {
      const current = this.novelUsage.get(novelId) || 0;
      if (current >= this.currentConfig.maxNovelCostUsd) {
        throw new BudgetExceededError(`Novel budget exceeded. Limit: ${this.currentConfig.maxNovelCostUsd}`);
      }
    }

    if (chapterId && this.currentConfig.maxChapterCostUsd !== undefined) {
      const current = this.chapterUsage.get(chapterId) || 0;
      if (current >= this.currentConfig.maxChapterCostUsd) {
        throw new BudgetExceededError(`Chapter budget exceeded. Limit: ${this.currentConfig.maxChapterCostUsd}`);
      }
    }

    if (jobId && this.currentConfig.maxJobCostUsd !== undefined) {
      const current = this.jobUsage.get(jobId) || 0;
      if (current >= this.currentConfig.maxJobCostUsd) {
        throw new BudgetExceededError(`Job budget exceeded. Limit: ${this.currentConfig.maxJobCostUsd}`);
      }
    }

    if (this.currentConfig.maxTokens !== undefined && this.tokenUsage >= this.currentConfig.maxTokens) {
      throw new BudgetExceededError(`Total token budget exceeded.`);
    }
  }

  recordUsage(novelId: string, chapterId: string | undefined, jobId: string | undefined, usage: GenerationUsage): void {
    const cost = usage.estimatedCostUsd;
    
    const nCost = this.novelUsage.get(novelId) || 0;
    this.novelUsage.set(novelId, nCost + cost);

    if (chapterId) {
      const cCost = this.chapterUsage.get(chapterId) || 0;
      this.chapterUsage.set(chapterId, cCost + cost);
    }

    if (jobId) {
      const jCost = this.jobUsage.get(jobId) || 0;
      this.jobUsage.set(jobId, jCost + cost);
    }

    this.tokenUsage += usage.totalTokens;
    
    // Check post-flight just to throw if they went over during this last call
    this.checkPreFlightBudget(novelId, chapterId, jobId);
  }
}
