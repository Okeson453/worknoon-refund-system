import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

const app = createApp();

describe('GET /api/health', () => {
  it('reports service, database and AI status', async () => {
    const response = await request(app).get('/api/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('ok');
    expect(['enabled', 'disabled', 'degraded']).toContain(response.body.ai);
    expect(response.body.aiProvider).toBe('mock');
    expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
  });

  it('echoes the request id so a report can be traced', async () => {
    const response = await request(app).get('/api/health').set('X-Request-Id', 'req_health_test').expect(200);
    expect(response.headers['x-request-id']).toBe('req_health_test');
  });

  it('returns a JSON 404 envelope for an unknown route', async () => {
    const response = await request(app).get('/api/does-not-exist').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.requestId).toMatch(/^req_/);
    expect(JSON.stringify(response.body)).not.toContain('at Object');
  });
});
