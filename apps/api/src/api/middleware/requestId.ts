import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../../utils/logger';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/**
 * Correlation id for every request (spec §36). It is echoed in the response header and in every
 * error envelope, and it is propagated into the audit trail so one refund can be traced end to end.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const requestId = incoming && /^[\w-]{1,64}$/.test(incoming) ? incoming : `req_${randomUUID()}`;
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.info(
      {
        event: 'http.request',
        requestId: req.requestId,
        method: req.method,
        route: req.route?.path ?? req.path,
        status: res.statusCode,
        latencyMs: Math.round(latencyMs * 100) / 100,
      },
      'request completed',
    );
  });
  next();
}
