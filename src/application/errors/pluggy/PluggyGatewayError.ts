import { HttpError } from '../http/HttpError.js';
import { ErrorCode } from '../ErrorCode.js';

export class PluggyGatewayError extends HttpError {
  constructor(message = 'Failed to communicate with Pluggy.') {
    super(502, ErrorCode.BAD_GATEWAY, message);
  }
}
