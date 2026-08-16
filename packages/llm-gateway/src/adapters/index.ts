import { LlmRequest, LlmResponse } from '../types';

export interface LlmProviderAdapter {
  generate(request: LlmRequest): Promise<LlmResponse>;
}

export * from './mock.adapter';
export * from './openai.adapter';
export * from './ollama.adapter';
export * from './stub.adapter';
