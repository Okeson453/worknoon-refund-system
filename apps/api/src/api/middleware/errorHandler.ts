import { Prisma } from '@prisma/client';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@worknoon/shared-types';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { toFieldErrors } from '../../validation/common.schemas';

/**
 * Single exit point for errors. Clients only ever see a code, a customer-safe message and the
 * request id; stack traces and driver messages stay in the log (spec §25).
 */
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId ?? 'req_unknown';

  if (error instanceof ZodError) {
    const body: ApiErrorBody = {
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request payload.', requestId, details: toFieldErrors(error) },
    };
    res.status(400).json(body);
    return;
  }

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error({ event: 'http.error', requestId, code: error.code, message: error.message }, 'request failed');
    }
    const body: ApiErrorBody = { error: { code: error.code, message: error.message, requestId, details: error.details } };
    res.status(error.statusCode).json(body);
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error({ event: 'db.error', requestId, code: error.code }, 'database rejected the request');
    const body: ApiErrorBody = { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', requestId } };
    res.status(500).json(body);
    return;
  }

  logger.error(
    { event: 'http.unhandled', requestId, message: error instanceof Error ? error.message : String(error) },
    'unhandled error',
  );
  const body: ApiErrorBody = { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', requestId } };
  res.status(500).json(body);
}

/**
 * Express 4 does not forward rejected promises from async handlers, which would leave the
 * request hanging. Every async controller is therefore wrapped so failures always reach the
 * central error handler and produce the documented error envelope.
 */
export function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
