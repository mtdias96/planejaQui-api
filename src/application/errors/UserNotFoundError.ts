import { HttpError } from './http/HttpError.js';
import { ErrorCode } from './ErrorCode.js';

export class UserNotFoundError extends HttpError {
  constructor(message = 'User not found.') {
    super(404, ErrorCode.USER_NOT_FOUND, message);
  }
}
