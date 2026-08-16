export type LlmProvider = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'nine-router' | 'mock';

export type LlmMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
}

export interface LlmUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface LlmCost {
  currency: string;
  estimated_amount: number;
}

export interface LlmModelConfig {
  provider: LlmProvider;
  model: string;
  display_name?: string;
  input_cost_per_million?: number;
  output_cost_per_million?: number;
  context_window?: number;
}

export interface LlmRequest {
  provider: LlmProvider;
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  max_tokens?: number;
  abortSignal?: AbortSignal;
  timeoutMs?: number;
}

export interface LlmResponse {
  request_id?: string;
  provider: LlmProvider;
  model: string;
  message: LlmMessage;
  usage?: LlmUsage;
  cost?: LlmCost;
}

export class LlmGatewayError extends Error {
  public provider: LlmProvider;
  public retryable: boolean;
  public statusCode?: number;
  public code?: string;

  constructor(
    message: string,
    provider: LlmProvider,
    retryable: boolean,
    statusCode?: number,
    code?: string
  ) {
    super(message);
    this.name = 'LlmGatewayError';
    this.provider = provider;
    this.retryable = retryable;
    this.statusCode = statusCode;
    this.code = code;
  }
}
