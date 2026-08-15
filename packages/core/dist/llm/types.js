export var LLMErrorCode;
(function (LLMErrorCode) {
    LLMErrorCode["RATE_LIMITED"] = "RATE_LIMITED";
    LLMErrorCode["AUTHENTICATION_FAILED"] = "AUTHENTICATION_FAILED";
    LLMErrorCode["INVALID_REQUEST"] = "INVALID_REQUEST";
    LLMErrorCode["CONTEXT_LENGTH_EXCEEDED"] = "CONTEXT_LENGTH_EXCEEDED";
    LLMErrorCode["PROVIDER_UNAVAILABLE"] = "PROVIDER_UNAVAILABLE";
    LLMErrorCode["TIMEOUT"] = "TIMEOUT";
    LLMErrorCode["INVALID_RESPONSE"] = "INVALID_RESPONSE";
    LLMErrorCode["UNKNOWN"] = "UNKNOWN";
})(LLMErrorCode || (LLMErrorCode = {}));
export class LLMError extends Error {
    code;
    provider;
    retryable;
    statusCode;
    cause;
    constructor(opts) {
        super(opts.message);
        this.name = 'LLMError';
        this.code = opts.code;
        this.provider = opts.provider;
        this.retryable = opts.retryable;
        this.statusCode = opts.statusCode;
        this.cause = opts.cause;
    }
}
