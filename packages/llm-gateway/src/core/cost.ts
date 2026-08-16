import { LlmCost, LlmModelConfig, LlmUsage } from '../types';

export function estimateCost(usage: LlmUsage, config: LlmModelConfig): LlmCost {
  if (
    typeof config.input_cost_per_million !== 'number' ||
    typeof config.output_cost_per_million !== 'number'
  ) {
    return {
      currency: 'USD',
      estimated_amount: 0,
    };
  }

  const inputCost = (usage.input_tokens / 1_000_000) * config.input_cost_per_million;
  const outputCost = (usage.output_tokens / 1_000_000) * config.output_cost_per_million;

  return {
    currency: 'USD',
    estimated_amount: inputCost + outputCost,
  };
}
