import { HttpError } from './http/HttpError.js';
import { ErrorCode } from './ErrorCode.js';

export class InvalidRefreshTokenError extends HttpError {
  constructor() {
    super(401, ErrorCode.UNAUTHORIZED, 'Invalid or expired refresh token.');
  }
}
