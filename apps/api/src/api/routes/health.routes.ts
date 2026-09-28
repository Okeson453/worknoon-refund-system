import { Router } from 'express';
import { healthController } from '../../controllers/health.controller';
import { asyncHandler } from '../middleware/errorHandler';

export const healthRouter = Router();

healthRouter.get('/', asyncHandler(healthController));
