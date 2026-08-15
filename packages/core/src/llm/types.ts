import { z } from 'zod';

export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMGenerationConfig = {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  responseFormat?: "json_object" | "text";
};

export enum LLMErrorCode {
  RATE_LIMITED = "RATE_LIMITED",
  AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
  INVALID_REQUEST = "INVALID_REQUEST",
  CONTEXT_LENGTH_EXCEEDED = "CONTEXT_LENGTH_EXCEEDED",
  PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE",
  TIMEOUT = "TIMEOUT",
  INVALID_RESPONSE = "INVALID_RESPONSE",
  UNKNOWN = "UNKNOWN"
}

export class LLMError extends Error {
  code: LLMErrorCode;
  provider: string;
  retryable: boolean;
  statusCode?: number;
  cause?: any;

  constructor(opts: {
    message: string;
    code: LLMErrorCode;
    provider: string;
    retryable: boolean;
    statusCode?: number;
    cause?: any;
  }) {
    super(opts.message);
    this.name = 'LLMError';
    this.code = opts.code;
    this.provider = opts.provider;
    this.retryable = opts.retryable;
    this.statusCode = opts.statusCode;
    this.cause = opts.cause;
  }
}

export interface ILLMProvider {
  generateText(messages: LLMMessage[], config?: LLMGenerationConfig): Promise<string>;
  generateStructured<T>(messages: LLMMessage[], schema: z.ZodType<T>, config?: LLMGenerationConfig): Promise<T>;
}
