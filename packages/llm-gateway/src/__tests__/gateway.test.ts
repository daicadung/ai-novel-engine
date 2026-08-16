import { describe, it, expect } from 'vitest';
import { LlmGateway } from '../core/gateway';
import { MockAdapter, StubAdapter } from '../adapters';

describe('LlmGateway', () => {
  it('routes to configured adapter', async () => {
    const gateway = new LlmGateway({
      mock: new MockAdapter(),
      openai: new StubAdapter('openai'),
      anthropic: new StubAdapter('anthropic'),
      gemini: new StubAdapter('gemini'),
      ollama: new StubAdapter('ollama'),
      'nine-router': new StubAdapter('nine-router')
    });

    const res = await gateway.generate(
      { provider: 'mock', model: 'test-model', messages: [{ role: 'user', content: 'hi' }] },
      { provider: 'mock', model: 'test-model' }
    );

    expect(res.provider).toBe('mock');
  });

  it('rejects unconfigured provider', async () => {
    const gateway = new LlmGateway({
      mock: new MockAdapter()
    });

    await expect(gateway.generate(
      { provider: 'openai', model: 'test-model', messages: [] },
      { provider: 'openai', model: 'test-model' }
    )).rejects.toThrow('No adapter configured');
  });

  it('rejects mismatched config and request', async () => {
    const gateway = new LlmGateway({
      mock: new MockAdapter()
    });

    await expect(gateway.generate(
      { provider: 'mock', model: 'mismatch', messages: [] },
      { provider: 'mock', model: 'test-model' }
    )).rejects.toThrow('Config mismatch');
  });
});
