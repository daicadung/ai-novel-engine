import { describe, it, expect } from 'vitest';
import { MockAdapter } from '../adapters';

describe('MockAdapter', () => {
  it('returns default response', async () => {
    const adapter = new MockAdapter();
    const res = await adapter.generate({
      provider: 'mock',
      model: 'default-model',
      messages: [{ role: 'user', content: 'hello' }]
    });

    expect(res.provider).toBe('mock');
    expect(res.model).toBe('default-model');
    expect(res.message.content).toContain('1 messages');
    expect(res.usage?.total_tokens).toBe(30);
  });

  it('returns explicit mock response', async () => {
    const adapter = new MockAdapter();
    adapter.setMockResponse('my-model', {
      provider: 'mock',
      model: 'my-model',
      message: { role: 'assistant', content: 'explicit answer' }
    });

    const res = await adapter.generate({
      provider: 'mock',
      model: 'my-model',
      messages: [{ role: 'user', content: 'hello' }]
    });

    expect(res.message.content).toBe('explicit answer');
  });

  it('simulates errors', async () => {
    const adapter = new MockAdapter();
    await expect(adapter.generate({
      provider: 'mock',
      model: 'error-model',
      messages: []
    })).rejects.toThrow('Simulated mock error');
  });
});
