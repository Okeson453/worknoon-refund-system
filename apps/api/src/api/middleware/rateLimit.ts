import rateLimit from 'express-rate-limit';
import type { NextFunction, Request, Response } from 'express';
import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from '../../config/constants';
import { rateLimitError } from '../../utils/errors';

function handler(_req: Request, _res: Response, next: NextFunction): void {
  next(rateLimitError('Too many refund requests. Please wait a minute and try again.'));
}

/** Per-IP limit on the customer submission endpoint: 20 requests per minute (spec v1.1 §10.1). */
export const refundRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
});
