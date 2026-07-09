import { ErrorCode } from '@application/errors/ErrorCode.js';

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}
