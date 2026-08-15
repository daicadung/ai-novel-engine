import { BaseProvider } from './BaseProvider.js';
import { LLMMessage, LLMGenerationConfig, LLMErrorCode } from '@ane/core';

export class GoogleProvider extends BaseProvider {
  protected providerName = 'Google';
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey?: string, defaultModel?: string) {
    super();
    this.apiKey = apiKey || process.env.GOOGLE_API_KEY || '';
    this.defaultModel = defaultModel || process.env.GOOGLE_MODEL || 'gemini-1.5-pro-latest';
  }

  async generateText(messages: LLMMessage[], config?: LLMGenerationConfig): Promise<string> {
    if (!this.apiKey) {
      throw this.createError(LLMErrorCode.AUTHENTICATION_FAILED, "Missing Google API Key", false);
    }

    const systemMessage = messages.find(m => m.role === 'system')?.content;
    const contents = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    return this.withRetry(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      try {
        const model = config?.model || this.defaultModel;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: systemMessage ? { parts: [{ text: systemMessage }] } : undefined,
            contents,
            generationConfig: {
              temperature: config?.temperature ?? 0.7,
              maxOutputTokens: config?.maxTokens,
              responseMimeType: config?.responseFormat === 'json_object' ? 'application/json' : 'text/plain'
            }
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          this.mapError(response.status, errBody);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
      } catch (e: any) {
        if (e.name === 'AbortError') {
          throw this.createError(LLMErrorCode.TIMEOUT, "Google Request Timed out", true);
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

    if (status === 400) code = LLMErrorCode.INVALID_REQUEST;
    else if (status === 401 || status === 403) code = LLMErrorCode.AUTHENTICATION_FAILED;
    else if (status === 429) { code = LLMErrorCode.RATE_LIMITED; retryable = true; }
    else if (status >= 500) { code = LLMErrorCode.PROVIDER_UNAVAILABLE; retryable = true; }

    throw this.createError(code, body.error?.message || `HTTP ${status}`, retryable, status, body);
  }
}
