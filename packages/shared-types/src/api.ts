import type { AiHealthState, ApiErrorCode } from './enums';

/** Single error envelope used by every non-2xx API response. */
export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
    details?: Array<{ path: string; message: string }>;
  };
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PagedResponse<T> {
  items: T[];
  pagination: Pagination;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'ok' | 'down';
  ai: AiHealthState;
  aiProvider: string;
  timestamp: string;
}
