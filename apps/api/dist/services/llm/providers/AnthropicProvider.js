import { BaseProvider } from './BaseProvider.js';
import { LLMErrorCode } from '@ane/core';
export class AnthropicProvider extends BaseProvider {
    providerName = 'Anthropic';
    apiKey;
    defaultModel;
    constructor(apiKey, defaultModel) {
        super();
        this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || '';
        this.defaultModel = defaultModel || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20240620';
    }
    async generateText(messages, config) {
        if (!this.apiKey) {
            throw this.createError(LLMErrorCode.AUTHENTICATION_FAILED, "Missing Anthropic API Key", false);
        }
        // Anthropic requires system message separately
        const systemMessages = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
        const userAssistantMessages = messages.filter(m => m.role !== 'system');
        return this.withRetry(async () => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 60000);
            try {
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': this.apiKey,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: config?.model || this.defaultModel,
                        system: systemMessages || undefined,
                        messages: userAssistantMessages,
                        temperature: config?.temperature ?? 0.7,
                        max_tokens: config?.maxTokens || 4096
                    }),
                    signal: controller.signal
                });
                if (!response.ok) {
                    const errBody = await response.json().catch(() => ({}));
                    this.mapError(response.status, errBody);
                }
                const data = await response.json();
                return data.content[0].text;
            }
            catch (e) {
                if (e.name === 'AbortError') {
                    throw this.createError(LLMErrorCode.TIMEOUT, "Anthropic Request Timed out", true);
                }
                throw e;
            }
            finally {
                clearTimeout(timeout);
            }
        });
    }
    mapError(status, body) {
        let code = LLMErrorCode.UNKNOWN;
        let retryable = false;
        if (status === 401 || status === 403)
            code = LLMErrorCode.AUTHENTICATION_FAILED;
        else if (status === 429) {
            code = LLMErrorCode.RATE_LIMITED;
            retryable = true;
        }
        else if (status === 400)
            code = LLMErrorCode.INVALID_REQUEST;
        else if (status >= 500) {
            code = LLMErrorCode.PROVIDER_UNAVAILABLE;
            retryable = true;
        }
        throw this.createError(code, body.error?.message || `HTTP ${status}`, retryable, status, body);
    }
}
