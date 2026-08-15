export class ValidationError extends Error {
    message;
    details;
    constructor(message, details) {
        super(message);
        this.message = message;
        this.details = details;
        this.name = 'ValidationError';
    }
}
export class NotFoundError extends Error {
    message;
    constructor(message = 'Not found') {
        super(message);
        this.message = message;
        this.name = 'NotFoundError';
    }
}
