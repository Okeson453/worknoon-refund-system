import type { NextFunction, Request, Response } from 'express';
import { routeNotFoundError } from '../../utils/errors';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(routeNotFoundError());
}
