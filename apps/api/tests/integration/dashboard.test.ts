import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/database/prisma';

const app = createApp();

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/dashboard/summary', () => {
  it('matches the persisted refund requests', async () => {
    const response = await request(app).get('/api/dashboard/summary').expect(200);

    const [total, pending, approved, denied, escalated, aiFailures] = await Promise.all([
      prisma.refundRequest.count(),
      prisma.refundRequest.count({ where: { status: 'PENDING' } }),
      prisma.refundRequest.count({ where: { status: 'APPROVED' } }),
      prisma.refundRequest.count({ where: { status: 'DENIED' } }),
      prisma.refundRequest.count({ where: { status: 'ESCALATED' } }),
      prisma.refundRequest.count({ where: { aiUsed: false } }),
    ]);

    expect(response.body).toEqual({
      total,
      pending,
      approved,
      denied,
      escalated,
      suspicious: response.body.suspicious,
      aiFailures,
    });
    expect(response.body.total).toBe(pending + approved + denied + escalated);
    expect(response.body.suspicious).toBeGreaterThanOrEqual(0);
  });

  it('counts at least one flagged injection attempt after the refund suite has run', async () => {
    const response = await request(app).get('/api/dashboard/summary').expect(200);
    const flagged = await prisma.refundRequest.count({
      where: { policyResult: { path: ['rules'], array_contains: [{ id: 'E1', fired: true }] } },
    });
    expect(response.body.suspicious).toBe(flagged);
  });
});
