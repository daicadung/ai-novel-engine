import { describe, it, expect } from 'vitest';
import { estimateCost } from '../core/cost';

describe('Cost Estimator', () => {
  it('calculates cost per million', () => {
    const cost = estimateCost(
      { input_tokens: 1_500_000, output_tokens: 500_000, total_tokens: 2_000_000 },
      { provider: 'openai', model: 'gpt-4o', input_cost_per_million: 5, output_cost_per_million: 15 }
    );
    // Input: 1.5 * 5 = 7.5
    // Output: 0.5 * 15 = 7.5
    // Total: 15
    expect(cost.estimated_amount).toBe(15);
    expect(cost.currency).toBe('USD');
  });

  it('returns zero for unknown costs', () => {
    const cost = estimateCost(
      { input_tokens: 1_500_000, output_tokens: 500_000, total_tokens: 2_000_000 },
      { provider: 'ollama', model: 'llama3' } // no cost defined
    );
    expect(cost.estimated_amount).toBe(0);
  });
});
