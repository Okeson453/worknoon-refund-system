import type { ApiErrorCode } from '@worknoon/shared-types';

/** Domain error carrying the customer-safe code that is rendered in the API error envelope. */
export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number;
  readonly details?: Array<{ path: string; message: string }>;

  constructor(
    code: ApiErrorCode,
    statusCode: number,
    message: string,
    details?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function validationError(message: string, details?: Array<{ path: string; message: string }>): AppError {
  return new AppError('VALIDATION_ERROR', 400, message, details);
}

/** Deliberately identical for unknown customers, unknown orders and orders owned by someone else. */
export function notFoundError(message = 'Customer or order not found.'): AppError {
  return new AppError('RESOURCE_NOT_FOUND', 404, message);
}

export function unauthorizedError(message = 'A valid admin API key is required.'): AppError {
  return new AppError('UNAUTHORIZED', 401, message);
}

export function rateLimitError(message = 'Too many requests.'): AppError {
  return new AppError('RATE_LIMITED', 429, message);
}

export function routeNotFoundError(): AppError {
  return new AppError('NOT_FOUND', 404, 'The requested endpoint does not exist.');
}
