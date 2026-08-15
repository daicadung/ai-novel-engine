import { BaseProvider } from './BaseProvider.js';
import { LLMMessage, LLMGenerationConfig, LLMErrorCode } from '@ane/core';

export class OllamaProvider extends BaseProvider {
  protected providerName = 'Ollama';
  private baseUrl: string;
  private defaultModel: string;

  constructor(baseUrl?: string, defaultModel?: string) {
    super();
    this.baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.defaultModel = defaultModel || process.env.OLLAMA_MODEL || 'llama3';
  }

  async generateText(messages: LLMMessage[], config?: LLMGenerationConfig): Promise<string> {
    return this.withRetry(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      try {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config?.model || this.defaultModel,
            messages: messages,
            stream: false,
            options: {
              temperature: config?.temperature ?? 0.7,
              num_predict: config?.maxTokens
            },
            format: config?.responseFormat === 'json_object' ? 'json' : undefined
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          this.mapError(response.status, errText);
        }

        const data = await response.json();
        return data.message.content;
      } catch (e: any) {
        if (e.name === 'AbortError') {
          throw this.createError(LLMErrorCode.TIMEOUT, "Ollama Request Timed out", true);
        }
        if (e.cause?.code === 'ECONNREFUSED' || e.message.includes('fetch failed')) {
           throw this.createError(LLMErrorCode.PROVIDER_UNAVAILABLE, `Ollama is unreachable at ${this.baseUrl}`, true, undefined, e);
        }
        throw e;
      } finally {
        clearTimeout(timeout);
      }
    });
  }

  private mapError(status: number, errText: string) {
    let code = LLMErrorCode.UNKNOWN;
    let retryable = false;

    if (status === 400) code = LLMErrorCode.INVALID_REQUEST;
    else if (status >= 500) { code = LLMErrorCode.PROVIDER_UNAVAILABLE; retryable = true; }

    throw this.createError(code, errText || `HTTP ${status}`, retryable, status);
  }
}
