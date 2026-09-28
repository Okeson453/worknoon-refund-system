import { Router } from 'express';
import { customersRouter } from './customers.routes';
import { dashboardRouter } from './dashboard.routes';
import { healthRouter } from './health.routes';
import { refundsRouter } from './refunds.routes';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/refunds', refundsRouter);
apiRouter.use('/customers', customersRouter);
apiRouter.use('/dashboard', dashboardRouter);
