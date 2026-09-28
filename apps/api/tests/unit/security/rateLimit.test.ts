import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { refundRateLimiter } from '../../../src/api/middleware/rateLimit';
import { errorHandler } from '../../../src/api/middleware/errorHandler';
import { requestId } from '../../../src/api/middleware/requestId';
import { RATE_LIMIT_MAX_REQUESTS } from '../../../src/config/constants';

function buildApp() {
  const app = express();
  app.use(requestId);
  app.post('/submit', refundRateLimiter, (_req, res) => {
    res.status(201).json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe('refund submission rate limit', () => {
  it(`allows ${RATE_LIMIT_MAX_REQUESTS} requests and rejects the next one`, async () => {
    const app = buildApp();
    for (let index = 0; index < RATE_LIMIT_MAX_REQUESTS; index += 1) {
      const response = await request(app).post('/submit');
      expect(response.status).toBe(201);
    }

    const limited = await request(app).post('/submit');
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(limited.body.error.requestId).toMatch(/^req_/);
    expect(limited.body.error.message).not.toContain('stack');
  });
});
