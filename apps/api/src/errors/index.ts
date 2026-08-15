export class ValidationError extends Error {
  constructor(public message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(public message: string = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}
