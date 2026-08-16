import { LlmRequest, LlmResponse } from '../types';

export function buildSafeLlmLogMetadata(
  request: LlmRequest,
  response?: LlmResponse,
  error?: any,
  elapsedMs?: number
): Record<string, any> {
  const metadata: Record<string, any> = {
    provider: request.provider,
    model: request.model,
  };

  if (elapsedMs !== undefined) {
    metadata.elapsed_ms = elapsedMs;
  }

  if (response) {
    if (response.request_id) metadata.request_id = response.request_id;
    if (response.usage) {
      metadata.input_tokens = response.usage.input_tokens;
      metadata.output_tokens = response.usage.output_tokens;
      metadata.total_tokens = response.usage.total_tokens;
    }
    if (response.cost) {
      metadata.estimated_cost = response.cost.estimated_amount;
      metadata.currency = response.cost.currency;
    }
    metadata.status = 'success';
  }

  if (error) {
    metadata.status = 'error';
    if (error.code) metadata.error_code = error.code;
    if (error.statusCode) metadata.error_code = String(error.statusCode);
  }

  return metadata;
}
