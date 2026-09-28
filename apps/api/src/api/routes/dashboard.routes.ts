import { Router } from 'express';
import { adminAuth } from '../middleware/adminAuth';
import { getDashboardSummaryController } from '../../controllers/dashboard.controller';
import { asyncHandler } from '../middleware/errorHandler';

export const dashboardRouter = Router();

dashboardRouter.get('/summary', adminAuth, asyncHandler(getDashboardSummaryController));
