import { ErrorCode } from './ErrorCode.js';
import { HttpError } from './http/HttpError.js';

export class PluggyRateLimitError extends HttpError {
  constructor(readonly retryAfterSeconds?: number) {
    super(
      429,
      ErrorCode.TOO_MANY_REQUESTS,
      'Too many requests to Pluggy. Please try again later.',
    );
  }
}
