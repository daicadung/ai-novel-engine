import { describe, it, expect } from 'vitest';
import { withRetry } from '../core/retry';
import { LlmGatewayError } from '../types';

describe('Retry Logic', () => {
  it('succeeds on first try', async () => {
    let attempts = 0;
    const op = async () => {
      attempts++;
      return 'success';
    };

    const res = await withRetry(op);
    expect(res).toBe('success');
    expect(attempts).toBe(1);
  });

  it('retries on 429 and succeeds', async () => {
    let attempts = 0;
    const op = async () => {
      attempts++;
      if (attempts === 1) {
        throw new LlmGatewayError('Too Many Requests', 'openai', true, 429);
      }
      return 'success';
    };

    const promise = withRetry(op, { maxRetries: 2, baseDelayMs: 10 });
    const res = await promise;

    expect(res).toBe('success');
    expect(attempts).toBe(2);
  });

  it('does not retry on 400', async () => {
    let attempts = 0;
    const op = async () => {
      attempts++;
      throw new LlmGatewayError('Bad Request', 'openai', false, 400);
    };

    const promise = withRetry(op, { maxRetries: 2, baseDelayMs: 10 });
    await expect(promise).rejects.toThrow('Bad Request');
    expect(attempts).toBe(1);
  });

  it('exhausts max retries and throws', async () => {
    let attempts = 0;
    const op = async () => {
      attempts++;
      throw new LlmGatewayError('Server Error', 'openai', true, 500);
    };

    const promise = withRetry(op, { maxRetries: 2, baseDelayMs: 10 });
    await expect(promise).rejects.toThrow('Server Error');
    expect(attempts).toBe(3); // 1 initial + 2 retries
  });
});
