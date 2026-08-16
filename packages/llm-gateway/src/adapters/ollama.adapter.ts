import { LlmRequest, LlmResponse, LlmGatewayError } from '../types';
import { LlmProviderAdapter } from './index';

export interface OllamaConfig {
  baseUrl?: string;
}

export class OllamaAdapter implements LlmProviderAdapter {
  constructor(private config: OllamaConfig = {}) {}

  public async generate(request: LlmRequest): Promise<LlmResponse> {
    const baseUrl = this.config.baseUrl || 'http://localhost:11434';
    
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
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          stream: false,
          options: {
            temperature: request.temperature,
            num_predict: request.max_tokens,
          }
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new LlmGatewayError(
          `Ollama API error: ${res.statusText}`,
          'ollama',
          [429, 500, 502, 503, 504].includes(res.status),
          res.status
        );
      }

      const data = await res.json();
      
      return {
        provider: 'ollama',
        model: request.model,
        message: {
          role: 'assistant',
          content: data.message?.content || '',
        },
        usage: data.prompt_eval_count ? {
          input_tokens: data.prompt_eval_count,
          output_tokens: data.eval_count,
          total_tokens: data.prompt_eval_count + data.eval_count,
        } : undefined,
      };
    } catch (error: any) {
      if (error instanceof LlmGatewayError) throw error;
      
      throw new LlmGatewayError(
        error.message || 'Unknown network error',
        'ollama',
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
