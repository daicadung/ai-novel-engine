import { ILLMProvider } from '@ane/core';
import { MockProvider as NewMockProvider } from '../llm/providers/MockProvider.js';

// Backward compatibility for existing imports in Phase 2-5
export type LLMProvider = ILLMProvider;
export const MockProvider = NewMockProvider;
