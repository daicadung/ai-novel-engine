import { LlmGatewayError } from '../types';

const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

export interface RetryConfig {
  maxRetries?: number;
  baseDelayMs?: number;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const maxRetries = config.maxRetries ?? 2;
  const baseDelayMs = config.baseDelayMs ?? 1000;

  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof LlmGatewayError) {
        // Only retry if marked as retryable and status code matches or is missing (e.g. network failure)
        const isRetryableStatus = error.statusCode === undefined || RETRYABLE_STATUS_CODES.includes(error.statusCode);
        
        if (error.retryable && isRetryableStatus && attempt < maxRetries) {
          attempt++;
          // Exponential backoff
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // Not retryable or exceeded retries
      throw error;
    }
  }
}
