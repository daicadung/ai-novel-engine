import { LlmRequest, LlmResponse, LlmGatewayError } from '../types';
import { LlmProviderAdapter } from './index';

export interface OpenAiConfig {
  apiKey: string;
  baseUrl?: string;
}

export class OpenAiAdapter implements LlmProviderAdapter {
  constructor(private config: OpenAiConfig) {}

  public async generate(request: LlmRequest): Promise<LlmResponse> {
    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;

    if (request.timeoutMs) {
      timeoutId = setTimeout(() => controller.abort(), request.timeoutMs);
    }

    if (request.abortSignal) {
      if (request.abortSignal.aborted) {
        controller.abort();
      } else {
        request.abortSignal.addEventListener('abort', () => controller.abort(), { once: true });
      }
    }

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.max_tokens,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // Read body to get detailed error message from the provider (9router, OpenAI, etc.)
        let errorBody = '';
        try {
          const errJson = await res.json();
          errorBody = errJson?.error?.message || errJson?.message || JSON.stringify(errJson);
        } catch {
          try { errorBody = await res.text(); } catch { errorBody = res.statusText || String(res.status); }
        }
        throw new LlmGatewayError(
          `OpenAI API error ${res.status}: ${errorBody}`,
          'openai',
          [429, 500, 502, 503, 504].includes(res.status),
          res.status
        );
      }

      const data = await res.json();
      
      return {
        request_id: data.id,
        provider: 'openai',
        model: request.model,
        message: {
          role: 'assistant',
          content: data.choices?.[0]?.message?.content || '',
        },
        usage: data.usage ? {
          input_tokens: data.usage.prompt_tokens,
          output_tokens: data.usage.completion_tokens,
          total_tokens: data.usage.total_tokens,
        } : undefined,
      };
    } catch (error: any) {
      if (error instanceof LlmGatewayError) throw error;
      
      throw new LlmGatewayError(
        error.message || 'Unknown network error',
        'openai',
        error.name === 'AbortError' || error.name === 'TypeError',
        undefined,
        error.name
      );
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
