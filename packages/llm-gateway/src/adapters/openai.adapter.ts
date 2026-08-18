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
          stream: true,
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
          [429, 500, 502, 503, 504, 524].includes(res.status),
          res.status
        );
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new LlmGatewayError('Response body is missing or not readable', 'openai', true);
      }

      const decoder = new TextDecoder('utf-8');
      let fullContent = '';
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);

            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              const dataStr = line.slice(6).trim();
              if (dataStr) {
                try {
                  const data = JSON.parse(dataStr);
                  if (data.choices?.[0]?.delta?.content) {
                    fullContent += data.choices[0].delta.content;
                  }
                } catch (e) {
                  // Ignore JSON parse errors for incomplete chunks
                }
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        throw new LlmGatewayError('Error reading stream: ' + err.message, 'openai', true);
      }

      if (!fullContent) {
        throw new LlmGatewayError('Empty response from LLM via stream', 'openai', true);
      }

      return {
        request_id: 'streamed',
        provider: 'openai',
        model: request.model,
        message: {
          role: 'assistant',
          content: fullContent,
        },
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
