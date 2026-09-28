import { Router } from 'express';
import { adminAuth } from '../middleware/adminAuth';
import { refundRateLimiter } from '../middleware/rateLimit';
import {
  createRefundRequestController,
  getRefundRequestController,
  listRefundRequestsController,
} from '../../controllers/refund.controller';
import { asyncHandler } from '../middleware/errorHandler';

export const refundsRouter = Router();

// Customer-facing: the only write endpoint of the system.
refundsRouter.post('/', refundRateLimiter, asyncHandler(createRefundRequestController));
// Support-facing: full decision reasoning.
refundsRouter.get('/', adminAuth, asyncHandler(listRefundRequestsController));
refundsRouter.get('/:id', adminAuth, asyncHandler(getRefundRequestController));
