import { describe, expect, it } from 'vitest';
import { createRefundRequestSchema, listRefundRequestsQuerySchema } from '../../../src/validation/refund.schemas';

const VALID = {
  customerId: 'CUST-001',
  orderId: 'ORD-1001',
  itemIds: ['ITM-1001-1'],
  message: 'My headphones arrived damaged.',
};

describe('createRefundRequestSchema', () => {
  it('accepts a valid payload', () => {
    expect(createRefundRequestSchema.safeParse(VALID).success).toBe(true);
  });

  it.each(['customerId', 'orderId', 'itemIds', 'message'] as const)('rejects a payload without %s', (field) => {
    const payload = { ...VALID } as Record<string, unknown>;
    delete payload[field];
    expect(createRefundRequestSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects an empty item list', () => {
    expect(createRefundRequestSchema.safeParse({ ...VALID, itemIds: [] }).success).toBe(false);
  });

  it('rejects more than 20 items', () => {
    const itemIds = Array.from({ length: 21 }, (_, index) => `ITM-1-${index}`);
    expect(createRefundRequestSchema.safeParse({ ...VALID, itemIds }).success).toBe(false);
  });

  it.each([
    ['CUST 001', 'identifier with a space'],
    ['CUST-001; DROP TABLE orders', 'injection attempt'],
    ['', 'empty identifier'],
    ['x'.repeat(65), 'over-long identifier'],
  ])('rejects %s (%s)', (value) => {
    expect(createRefundRequestSchema.safeParse({ ...VALID, customerId: value }).success).toBe(false);
  });

  it('rejects a message below the minimum length', () => {
    expect(createRefundRequestSchema.safeParse({ ...VALID, message: '   ' }).success).toBe(false);
  });

  it('accepts a 1000 character message', () => {
    expect(createRefundRequestSchema.safeParse({ ...VALID, message: 'a'.repeat(1000) }).success).toBe(true);
  });

  it('rejects a 1001 character message', () => {
    expect(createRefundRequestSchema.safeParse({ ...VALID, message: 'a'.repeat(1001) }).success).toBe(false);
  });

  it('rejects spoofed policy fields', () => {
    expect(createRefundRequestSchema.safeParse({ ...VALID, finalSale: false, refundAmountCents: 1 }).success).toBe(false);
  });

  it('rejects a non-object body', () => {
    expect(createRefundRequestSchema.safeParse('refund please').success).toBe(false);
  });
});

describe('listRefundRequestsQuerySchema', () => {
  it('applies defaults', () => {
    expect(listRefundRequestsQuerySchema.parse({})).toEqual({ page: 1, limit: 25 });
  });

  it('coerces numeric strings', () => {
    expect(listRefundRequestsQuerySchema.parse({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10 });
  });

  it('rejects an unknown decision', () => {
    expect(listRefundRequestsQuerySchema.safeParse({ decision: 'MAYBE' }).success).toBe(false);
  });

  it.each(['APPROVED', 'DENIED', 'ESCALATED', 'PENDING'] as const)('accepts decision %s', (decision) => {
    expect(listRefundRequestsQuerySchema.safeParse({ decision }).success).toBe(true);
  });

  it('rejects a limit above the maximum page size', () => {
    expect(listRefundRequestsQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });
});
