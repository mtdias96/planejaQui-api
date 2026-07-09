import { ErrorCode } from '@application/errors/ErrorCode.js';

export abstract class ApplicationError extends Error {
  abstract readonly statusCode?: number;
  abstract readonly code: ErrorCode;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
