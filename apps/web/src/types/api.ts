export type { ApiErrorBody, HealthResponse, PagedResponse, Pagination } from '@worknoon/shared-types';
import type { ApiErrorCode } from '@worknoon/shared-types';

/** Field-level validation feedback returned by the API error envelope. */
export interface ApiFieldError {
  path: string;
  message: string;
}

export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
    details?: ApiFieldError[];
  };
}
