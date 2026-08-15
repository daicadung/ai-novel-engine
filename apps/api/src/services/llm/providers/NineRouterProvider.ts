import { BaseProvider } from './BaseProvider.js';
import { LLMMessage, LLMGenerationConfig, LLMErrorCode } from '@ane/core';

export class NineRouterProvider extends BaseProvider {
  protected providerName = '9Router';
  private apiKey: string;
  private defaultModel: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string, defaultModel?: string) {
    super();
    this.apiKey = apiKey || process.env.NINE_ROUTER_API_KEY || '';
    this.baseUrl = baseUrl || process.env.NINE_ROUTER_BASE_URL || 'https://9router.fft.vn/v1';
    this.defaultModel = defaultModel || process.env.MODEL || 'gpt-4o';
  }

  async generateText(messages: LLMMessage[], config?: LLMGenerationConfig): Promise<string> {
    if (!this.apiKey) {
      throw this.createError(LLMErrorCode.AUTHENTICATION_FAILED, "Missing 9Router API Key", false);
    }

    return this.withRetry(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: config?.model || this.defaultModel,
            messages: messages,
            temperature: config?.temperature ?? 0.7,
            max_tokens: config?.maxTokens,
            response_format: config?.responseFormat === 'json_object' ? { type: 'json_object' } : undefined
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          this.mapError(response.status, errBody);
        }

        const data = await response.json();
        return data.choices[0].message.content;
      } catch (e: any) {
        if (e.name === 'AbortError') {
          throw this.createError(LLMErrorCode.TIMEOUT, "9Router Request Timed out", true);
        }
        throw e;
      } finally {
        clearTimeout(timeout);
      }
    });
  }

  private mapError(status: number, body: any) {
    let code = LLMErrorCode.UNKNOWN;
    let retryable = false;

    if (status === 401) code = LLMErrorCode.AUTHENTICATION_FAILED;
    else if (status === 429) { code = LLMErrorCode.RATE_LIMITED; retryable = true; }
    else if (status === 400) code = LLMErrorCode.INVALID_REQUEST;
    else if (status >= 500) { code = LLMErrorCode.PROVIDER_UNAVAILABLE; retryable = true; }
    
    if (body.error?.code === 'context_length_exceeded') {
      code = LLMErrorCode.CONTEXT_LENGTH_EXCEEDED;
      retryable = false;
    }

    throw this.createError(code, body.error?.message || `HTTP ${status}`, retryable, status, body);
  }
}
