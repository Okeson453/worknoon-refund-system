import type { Request, Response } from 'express';
import { getAiProvider } from '../ai/ai.provider';
import { createRefundRequest } from '../services/refund/createRefundRequest';
import { getRefundRequest } from '../services/refund/getRefundRequest';
import { listRefundRequests } from '../services/refund/listRefundRequests';
import { validationError } from '../utils/errors';
import { idParamSchema, toFieldErrors } from '../validation/common.schemas';
import { createRefundRequestSchema, listRefundRequestsQuerySchema } from '../validation/refund.schemas';

export async function createRefundRequestController(req: Request, res: Response): Promise<void> {
  const parsed = createRefundRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw validationError('Invalid refund request.', toFieldErrors(parsed.error));
  }

  const result = await createRefundRequest({ payload: parsed.data, requestId: req.requestId, provider: getAiProvider() });
  res.status(201).json(result);
}

export async function listRefundRequestsController(req: Request, res: Response): Promise<void> {
  const parsed = listRefundRequestsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw validationError('Invalid list query.', toFieldErrors(parsed.error));
  }
  res.json(await listRefundRequests(parsed.data));
}

export async function getRefundRequestController(req: Request, res: Response): Promise<void> {
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) {
    throw validationError('Invalid refund request id.', toFieldErrors(parsed.error));
  }
  res.json(await getRefundRequest(parsed.data.id));
}
