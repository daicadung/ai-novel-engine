import { describe, it, expect } from 'vitest';
import { buildSafeLlmLogMetadata } from '../core/logging';
import { LlmRequest, LlmResponse, LlmGatewayError } from '../types';

describe('Logging Metadata Helper', () => {
  it('builds safe metadata without leaking prompt or response content', () => {
    const request: LlmRequest = {
      provider: 'openai',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'SECRET_PROMPT_CONTENT' }],
      temperature: 0.7,
    };

    const response: LlmResponse = {
      request_id: 'req_123',
      provider: 'openai',
      model: 'gpt-4o',
      message: { role: 'assistant', content: 'SECRET_RESPONSE_CONTENT' },
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      cost: { currency: 'USD', estimated_amount: 0.05 },
    };

    const meta = buildSafeLlmLogMetadata(request, response, undefined, 150);
    const serialized = JSON.stringify(meta);

    expect(serialized).not.toContain('SECRET_PROMPT_CONTENT');
    expect(serialized).not.toContain('SECRET_RESPONSE_CONTENT');

    expect(meta.provider).toBe('openai');
    expect(meta.model).toBe('gpt-4o');
    expect(meta.request_id).toBe('req_123');
    expect(meta.elapsed_ms).toBe(150);
    expect(meta.total_tokens).toBe(30);
    expect(meta.estimated_cost).toBe(0.05);
    expect(meta.status).toBe('success');
  });

  it('builds safe metadata for errors without raw error message', () => {
    const request: LlmRequest = {
      provider: 'ollama',
      model: 'llama3',
      messages: [{ role: 'system', content: 'system message' }],
    };

    const error = new LlmGatewayError('Sensitive internal stack trace', 'ollama', true, 500);

    const meta = buildSafeLlmLogMetadata(request, undefined, error, 50);
    const serialized = JSON.stringify(meta);

    expect(serialized).not.toContain('Sensitive internal stack trace');
    expect(serialized).not.toContain('system message');

    expect(meta.status).toBe('error');
    expect(meta.error_code).toBe('500');
  });
});
