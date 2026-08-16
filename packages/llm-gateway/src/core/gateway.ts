import { LlmProviderAdapter } from '../adapters';
import { LlmGatewayError, LlmModelConfig, LlmProvider, LlmRequest, LlmResponse } from '../types';
import { estimateCost } from './cost';
import { withRetry, RetryConfig } from './retry';

export class LlmGateway {
  private adapters: Map<LlmProvider, LlmProviderAdapter>;

  constructor(adapters: Partial<Record<LlmProvider, LlmProviderAdapter>>) {
    this.adapters = new Map();
    for (const [key, val] of Object.entries(adapters)) {
      if (val) {
        this.adapters.set(key as LlmProvider, val as LlmProviderAdapter);
      }
    }
  }

  public async generate(
    request: LlmRequest,
    config: LlmModelConfig,
    retryConfig?: RetryConfig
  ): Promise<LlmResponse> {
    const adapter = this.adapters.get(request.provider);

    if (!adapter) {
      throw new LlmGatewayError(
        `No adapter configured for provider: ${request.provider}`,
        request.provider,
        false
      );
    }

    if (request.model !== config.model || request.provider !== config.provider) {
      throw new LlmGatewayError(
        `Config mismatch: Request model/provider does not match config`,
        request.provider,
        false
      );
    }

    const response = await withRetry(async () => {
      return await adapter.generate(request);
    }, retryConfig);

    // If usage exists, calculate cost
    if (response.usage) {
      response.cost = estimateCost(response.usage, config);
    }

    return response;
  }
}
