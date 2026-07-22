import { HttpError } from './http/HttpError.js';
import { ErrorCode } from './ErrorCode.js';

export class EmailAlreadyInUseError extends HttpError {
  constructor() {
    super(409, ErrorCode.CONFLICT, 'Email already in use.');
  }
}
