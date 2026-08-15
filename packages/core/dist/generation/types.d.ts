export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}
export interface GenerationUsage extends TokenUsage {
    provider: string;
    model: string;
    latencyMs: number;
    queueWaitTimeMs?: number;
    generationDurationMs: number;
    retryCount: number;
    revisionCount: number;
    estimatedCostUsd: number;
}
export interface BudgetConfig {
    maxJobCostUsd?: number;
    maxChapterCostUsd?: number;
    maxNovelCostUsd?: number;
    maxDailyProviderCostUsd?: number;
    maxTokens?: number;
}
export interface GenerationEvent {
    id: string;
    correlationId: string;
    jobId?: string;
    novelId: string;
    chapterId?: string;
    sceneId?: string;
    stage: string;
    provider: string;
    model: string;
    status: 'STARTED' | 'COMPLETED' | 'FAILED' | 'BUDGET_EXCEEDED';
    usage?: GenerationUsage;
    validationPassed?: boolean;
    validationErrors?: any[];
    timestamp: Date;
}
export declare class BudgetExceededError extends Error {
    constructor(message: string);
}
