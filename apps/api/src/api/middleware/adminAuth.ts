import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { unauthorizedError } from '../../utils/errors';

function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Optional static bearer token for the support endpoints (spec §27).
 * When ADMIN_API_KEY is empty the endpoints stay open for the demo deployment; the trade-off is
 * documented in README and docs/SECURITY.md. It is deliberately not a real identity system.
 */
export function adminAuth(req: Request, _res: Response, next: NextFunction): void {
  if (env.ADMIN_API_KEY.length === 0) {
    next();
    return;
  }
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || typeof token !== 'string' || !safeEquals(token, env.ADMIN_API_KEY)) {
    next(unauthorizedError());
    return;
  }
  next();
}
