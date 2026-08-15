import { z } from 'zod';
import { ILLMProvider, LLMMessage, LLMGenerationConfig, TokenUsage } from '@ane/core';
import { BudgetManager } from './BudgetManager.js';
import { ObservabilityManager } from './ObservabilityManager.js';

export class LLMUsageProxy implements ILLMProvider {
  private delegate: ILLMProvider;
  private providerName: string;
  private novelId: string;
  private chapterId?: string;
  private jobId?: string;
  private stage: string;

  constructor(
    delegate: ILLMProvider,
    providerName: string,
    novelId: string,
    stage: string,
    chapterId?: string,
    jobId?: string
  ) {
    this.delegate = delegate;
    this.providerName = providerName;
    this.novelId = novelId;
    this.stage = stage;
    this.chapterId = chapterId;
    this.jobId = jobId;
  }

  getProviderName(): string {
    return this.providerName;
  }

  private handleUsage(model: string, latencyMs: number, usage?: TokenUsage) {
    const budgetManager = BudgetManager.getInstance();
    const obsManager = ObservabilityManager.getInstance();
    
    // If provider didn't return usage, fake it based on some heuristic or leave as 0
    const actualUsage = usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    
    const cost = budgetManager.calculateCost(this.providerName, model, actualUsage.inputTokens, actualUsage.outputTokens);
    
    const genUsage = {
      ...actualUsage,
      provider: this.providerName,
      model,
      latencyMs,
      generationDurationMs: latencyMs,
      retryCount: 0,
      revisionCount: 0,
      estimatedCostUsd: cost
    };

    budgetManager.recordUsage(this.novelId, this.chapterId, this.jobId, genUsage);

    obsManager.recordEvent({
      id: crypto.randomUUID(),
      correlationId: this.jobId || this.novelId,
      jobId: this.jobId,
      novelId: this.novelId,
      chapterId: this.chapterId,
      stage: this.stage,
      provider: this.providerName,
      model,
      status: 'COMPLETED',
      usage: genUsage,
      timestamp: new Date()
    });
  }

  async generateText(messages: LLMMessage[], config?: LLMGenerationConfig): Promise<string> {
    BudgetManager.getInstance().checkPreFlightBudget(this.novelId, this.chapterId, this.jobId);

    const start = Date.now();
    let capturedUsage: TokenUsage | undefined;
    
    const customConfig: LLMGenerationConfig = {
      ...config,
      onUsage: (u) => {
        capturedUsage = u;
        if (config?.onUsage) config.onUsage(u);
      }
    };

    try {
      const res = await this.delegate.generateText(messages, customConfig);
      const latency = Date.now() - start;
      this.handleUsage(config?.model || 'default', latency, capturedUsage);
      return res;
    } catch (e: any) {
      ObservabilityManager.getInstance().recordEvent({
        id: crypto.randomUUID(),
        correlationId: this.jobId || this.novelId,
        novelId: this.novelId,
        stage: this.stage,
        provider: this.providerName,
        model: config?.model || 'default',
        status: 'FAILED',
        timestamp: new Date()
      });
      throw e;
    }
  }

  async generateStructured<T>(messages: LLMMessage[], schema: z.ZodType<T>, config?: LLMGenerationConfig): Promise<T> {
    BudgetManager.getInstance().checkPreFlightBudget(this.novelId, this.chapterId, this.jobId);

    const start = Date.now();
    let capturedUsage: TokenUsage | undefined;

    const customConfig: LLMGenerationConfig = {
      ...config,
      onUsage: (u) => {
        capturedUsage = u;
        if (config?.onUsage) config.onUsage(u);
      }
    };

    try {
      const res = await this.delegate.generateStructured(messages, schema, customConfig);
      const latency = Date.now() - start;
      this.handleUsage(config?.model || 'default', latency, capturedUsage);
      return res;
    } catch (e: any) {
      ObservabilityManager.getInstance().recordEvent({
        id: crypto.randomUUID(),
        correlationId: this.jobId || this.novelId,
        novelId: this.novelId,
        stage: this.stage,
        provider: this.providerName,
        model: config?.model || 'default',
        status: 'FAILED',
        timestamp: new Date()
      });
      throw e;
    }
  }
}
