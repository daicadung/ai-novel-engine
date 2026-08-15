import { LLMError, LLMErrorCode } from '@ane/core';
export class BaseProvider {
    async withRetry(operation) {
        const maxRetries = 3;
        let attempt = 0;
        while (true) {
            try {
                return await operation();
            }
            catch (err) {
                attempt++;
                if (err instanceof LLMError && !err.retryable) {
                    throw err;
                }
                if (attempt >= maxRetries) {
                    if (err instanceof LLMError)
                        throw err;
                    throw this.createError(LLMErrorCode.UNKNOWN, err.message, false, undefined, err);
                }
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
    }
    createError(code, message, retryable, statusCode, cause) {
        return new LLMError({
            code,
            message,
            provider: this.providerName,
            retryable,
            statusCode,
            cause
        });
    }
    async generateStructured(messages, schema, config) {
        const responseFormatConfig = { ...config, responseFormat: 'json_object' };
        const text = await this.generateText(messages, responseFormatConfig);
        let parsed;
        try {
            // Find JSON block if response is wrapped
            let jsonText = text.trim();
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
            }
            else if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
            }
            parsed = JSON.parse(jsonText);
        }
        catch (e) {
            throw this.createError(LLMErrorCode.INVALID_RESPONSE, `Failed to parse JSON: ${e.message}`, false, undefined, e);
        }
        const validationResult = schema.safeParse(parsed);
        if (!validationResult.success) {
            throw this.createError(LLMErrorCode.INVALID_RESPONSE, `Zod validation failed: ${validationResult.error.message}`, false, undefined, validationResult.error);
        }
        return validationResult.data;
    }
}
