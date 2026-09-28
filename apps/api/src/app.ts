import express from 'express';
import type { Express } from 'express';
import { API_PREFIX } from './config/constants';
import { apiRouter } from './api/routes/index';
import { errorHandler } from './api/middleware/errorHandler';
import { notFoundHandler } from './api/middleware/notFound';
import { requestId, requestLogger } from './api/middleware/requestId';

export function createApp(): Express {
  const app = express();

  // The API runs behind the nginx container, so one proxy hop is trusted for client IPs.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(requestLogger);
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use(express.json({ limit: '32kb' }));

  app.use(API_PREFIX, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
