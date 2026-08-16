import { describe, it, expect, afterEach } from 'vitest';
import { OpenAiAdapter } from '../adapters/openai.adapter';

// Save original global fetch to restore later
const originalFetch = globalThis.fetch;

describe('Timeout Logic', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('aborts fetch with AbortController', async () => {
    const controller = new AbortController();
    
    globalThis.fetch = () => new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => resolve(new Response()), 10000);
      controller.signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });

    const adapter = new OpenAiAdapter({ apiKey: 'test' });
    
    const requestPromise = adapter.generate({
      provider: 'openai',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hello' }],
      abortSignal: controller.signal
    });

    setTimeout(() => controller.abort(), 10);
    await expect(requestPromise).rejects.toThrow('The operation was aborted');
  });

  it('aborts fetch using timeoutMs', async () => {
    globalThis.fetch = (_, init) => new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => resolve(new Response()), 10000);
      init?.signal?.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        const error = new Error('The operation was aborted timeoutMs');
        error.name = 'AbortError';
        reject(error);
      });
    });

    const adapter = new OpenAiAdapter({ apiKey: 'test' });
    
    const requestPromise = adapter.generate({
      provider: 'openai',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hello' }],
      timeoutMs: 10
    });

    await expect(requestPromise).rejects.toThrow('The operation was aborted timeoutMs');
  });
});
