import { LlmRequest, LlmResponse, LlmGatewayError } from '../types';
import { LlmProviderAdapter } from './index';

export class MockAdapter implements LlmProviderAdapter {
  private mockedResponses: Map<string, LlmResponse>;

  constructor() {
    this.mockedResponses = new Map();
  }

  public setMockResponse(model: string, response: LlmResponse) {
    this.mockedResponses.set(model, response);
  }

  public async generate(request: LlmRequest): Promise<LlmResponse> {
    if (request.model === 'error-model') {
      throw new LlmGatewayError('Simulated mock error', 'mock', true, 500);
    }
    if (request.model === 'fatal-model') {
      throw new LlmGatewayError('Simulated fatal error', 'mock', false, 400);
    }

    const mocked = this.mockedResponses.get(request.model);
    if (mocked) {
      return mocked;
    }

    // Default mock behavior
    return {
      provider: 'mock',
      model: request.model,
      message: {
        role: 'assistant',
        content: `Mocked response for ${request.messages.length} messages.`,
      },
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
      },
    };
  }
}
