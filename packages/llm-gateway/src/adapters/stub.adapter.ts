import { LlmRequest, LlmResponse, LlmGatewayError, LlmProvider } from '../types';
import { LlmProviderAdapter } from './index';

export class StubAdapter implements LlmProviderAdapter {
  constructor(private provider: LlmProvider) {}

  public async generate(request: LlmRequest): Promise<LlmResponse> {
    throw new LlmGatewayError(
      `Provider ${this.provider} is not yet implemented natively.`,
      this.provider,
      false
    );
  }
}
