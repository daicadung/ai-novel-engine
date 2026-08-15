import { z } from 'zod';
import { LLMMessage, LLMGenerationConfig, ILLMProvider, LLMError, LLMErrorCode } from '@ane/core';

export abstract class BaseProvider implements ILLMProvider {
  protected abstract providerName: string;
  
  getProviderName(): string {
    return this.providerName;
  }

  protected async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    const maxRetries = 3;
    let attempt = 0;
    
    while (true) {
      try {
        return await operation();
      } catch (err: any) {
        attempt++;
        if (err instanceof LLMError && !err.retryable) {
          throw err;
        }
        if (attempt >= maxRetries) {
          if (err instanceof LLMError) throw err;
          throw this.createError(LLMErrorCode.UNKNOWN, err.message, false, undefined, err);
        }
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  protected createError(code: LLMErrorCode, message: string, retryable: boolean, statusCode?: number, cause?: any): LLMError {
    return new LLMError({
      code,
      message,
      provider: this.providerName,
      retryable,
      statusCode,
      cause
    });
  }

  abstract generateText(messages: LLMMessage[], config?: LLMGenerationConfig): Promise<string>;
  
  async generateStructured<T>(messages: LLMMessage[], schema: z.ZodType<T>, config?: LLMGenerationConfig): Promise<T> {
    const responseFormatConfig = { ...config, responseFormat: 'json_object' as const };
    
    const text = await this.generateText(messages, responseFormatConfig);
    
    let parsed: any;
    try {
      // Find JSON block if response is wrapped
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
      }
      parsed = JSON.parse(jsonText);
    } catch (e: any) {
      throw this.createError(LLMErrorCode.INVALID_RESPONSE, `Failed to parse JSON: ${e.message}`, false, undefined, e);
    }
    
    const validationResult = schema.safeParse(parsed);
    if (!validationResult.success) {
      throw this.createError(LLMErrorCode.INVALID_RESPONSE, `Zod validation failed: ${validationResult.error.message}`, false, undefined, validationResult.error);
    }
    
    return validationResult.data;
  }
}
