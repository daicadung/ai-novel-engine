import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { ProviderFactory } from '../src/services/llm/factory.js';
import { MockProvider } from '../src/services/llm/providers/MockProvider.js';
import { OpenAIProvider } from '../src/services/llm/providers/OpenAIProvider.js';
import { OllamaProvider } from '../src/services/llm/providers/OllamaProvider.js';
import { LLMErrorCode, LLMError, LLMMessage } from '@ane/core';

describe('LLM Infrastructure', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Provider Factory & Routing', () => {
    it('should default to MockProvider if no env vars set', () => {
      const provider = ProviderFactory.getProvider();
      expect(provider).toBeInstanceOf(MockProvider);
    });

    it('should resolve global provider from env', () => {
      vi.stubEnv('LLM_PROVIDER', 'openai');
      const provider = ProviderFactory.getProvider();
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('should resolve stage-specific provider over global', () => {
      vi.stubEnv('LLM_PROVIDER', 'openai');
      vi.stubEnv('ARCHITECT_LLM_PROVIDER', 'ollama');
      
      const architectProvider = ProviderFactory.getProvider('ARCHITECT');
      const genericProvider = ProviderFactory.getProvider();
      
      expect(architectProvider).toBeInstanceOf(OllamaProvider);
      expect(genericProvider).toBeInstanceOf(OpenAIProvider);
    });
  });

  describe('Missing API Key Handling', () => {
    it('should throw AUTHENTICATION_FAILED if API key is missing', async () => {
      // Intentionally empty key
      const provider = new OpenAIProvider('');
      
      await expect(provider.generateText([{ role: 'user', content: 'test' }]))
        .rejects
        .toThrowError(
          expect.objectContaining({
            code: LLMErrorCode.AUTHENTICATION_FAILED
          })
        );
    });
  });

  describe('Normalized Error & Retry Logic', () => {
    it('should not retry on non-retryable errors', async () => {
      const provider = new OpenAIProvider('fake-key');
      
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: { message: "Bad Request" } })
      } as any);

      await expect(provider.generateText([{ role: 'user', content: 'test' }]))
        .rejects
        .toThrowError(
          expect.objectContaining({
            code: LLMErrorCode.INVALID_REQUEST,
            retryable: false
          })
        );
      
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on rate limits and fail if exhausted', async () => {
      const provider = new OpenAIProvider('fake-key');
      
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: { message: "Too many requests" } })
      } as any);

      const startTime = Date.now();
      
      await expect(provider.generateText([{ role: 'user', content: 'test' }]))
        .rejects
        .toThrowError(
          expect.objectContaining({
            code: LLMErrorCode.RATE_LIMITED,
            retryable: true
          })
        );
      
      // Should have been called multiple times
      expect(global.fetch).toHaveBeenCalledTimes(4); // BaseProvider retry limit is 3 attempts
    }, 10000);
  });

  describe('Structured JSON Parsing & Zod Validation', () => {
    const TestSchema = z.object({
      field: z.string(),
      count: z.number()
    });

    it('should successfully parse valid JSON and Zod schema', async () => {
      const provider = new MockProvider();
      vi.spyOn(provider, 'generateText').mockResolvedValue(JSON.stringify({
        field: "success",
        count: 42
      }));

      const result = await provider.generateStructured([{ role: 'user', content: 'test' }], TestSchema);
      expect(result.field).toBe("success");
      expect(result.count).toBe(42);
    });

    it('should fail with INVALID_RESPONSE if JSON is malformed', async () => {
      const provider = new MockProvider();
      vi.spyOn(provider, 'generateText').mockResolvedValue("This is not JSON {");

      await expect(provider.generateStructured([{ role: 'user', content: 'test' }], TestSchema))
        .rejects
        .toThrowError(
          expect.objectContaining({
            code: LLMErrorCode.INVALID_RESPONSE
          })
        );
    });

    it('should fail with INVALID_RESPONSE if Zod validation fails', async () => {
      const provider = new MockProvider();
      vi.spyOn(provider, 'generateText').mockResolvedValue(JSON.stringify({
        field: "missing count"
      }));

      await expect(provider.generateStructured([{ role: 'user', content: 'test' }], TestSchema))
        .rejects
        .toThrowError(
          expect.objectContaining({
            code: LLMErrorCode.INVALID_RESPONSE
          })
        );
    });
  });
});
