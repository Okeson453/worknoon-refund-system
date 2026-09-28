import { Router } from 'express';
import {
  getCustomerController,
  getCustomerOrdersController,
  getCustomersController,
} from '../../controllers/customer.controller';
import { asyncHandler } from '../middleware/errorHandler';

export const customersRouter = Router();

// Demo/CRM selector data. Contains synthetic challenge data only.
customersRouter.get('/', asyncHandler(getCustomersController));
customersRouter.get('/:id', asyncHandler(getCustomerController));
customersRouter.get('/:id/orders', asyncHandler(getCustomerOrdersController));
