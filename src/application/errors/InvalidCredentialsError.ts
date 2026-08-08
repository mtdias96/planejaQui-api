import { HttpError } from './http/HttpError.js';
import { ErrorCode } from './ErrorCode.js';

export class InvalidCredentialsError extends HttpError {
  constructor(message = 'Invalid credentials.') {
    super(401, ErrorCode.INVALID_CREDENTIALS, message);
  }
}
