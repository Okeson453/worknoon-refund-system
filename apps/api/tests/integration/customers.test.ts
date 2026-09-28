import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { EXPECTED_CUSTOMERS } from '../fixtures/customers';
import { EXPECTED_ORDERS, orderFor } from '../fixtures/orders';

const app = createApp();

describe('GET /api/customers', () => {
  it('returns the 15 seeded synthetic customers without contact details', async () => {
    const response = await request(app).get('/api/customers').expect(200);

    expect(response.body.items).toHaveLength(15);
    expect(response.body.items).toEqual(EXPECTED_CUSTOMERS);
    expect(JSON.stringify(response.body)).not.toContain('phone');
  });
});

describe('GET /api/customers/:id', () => {
  it('returns the demo customer profile', async () => {
    const response = await request(app).get('/api/customers/CUST-001').expect(200);
    expect(response.body).toEqual(EXPECTED_CUSTOMERS[0]);
  });

  it('returns 404 for an unknown customer', async () => {
    const response = await request(app).get('/api/customers/CUST-999').expect(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('returns 400 for a malformed customer id', async () => {
    const response = await request(app).get('/api/customers/CUST 001').expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details?.[0].path).toBe('id');
  });
});

describe('GET /api/customers/:id/orders', () => {
  it('returns the customer orders with verified item flags', async () => {
    const response = await request(app).get('/api/customers/CUST-001/orders').expect(200);

    expect(response.body.items).toHaveLength(1);
    const order = response.body.items[0];
    const expected = orderFor('CUST-001', 'ORD-1001');
    expect(order.id).toBe(expected.orderId);
    expect(order.status).toBe(expected.status);
    expect(order.totalCents).toBe(expected.totalCents);
    expect(order.items[0]).toMatchObject({ id: 'ITM-1001-1', damaged: true, finalSale: false, incorrectItem: false });
  });

  it('returns both orders for a customer with a boundary pair', async () => {
    const response = await request(app).get('/api/customers/CUST-010/orders').expect(200);
    expect(response.body.items.map((order: { id: string }) => order.id).sort()).toEqual(['ORD-1010', 'ORD-1011']);
  });

  it('never exposes orders of another customer', async () => {
    const response = await request(app).get('/api/customers/CUST-002/orders').expect(200);
    const orderIds = response.body.items.map((order: { id: string }) => order.id);
    for (const order of EXPECTED_ORDERS.filter((candidate) => candidate.customerId !== 'CUST-002')) {
      expect(orderIds).not.toContain(order.orderId);
    }
  });

  it('returns 404 for an unknown customer', async () => {
    await request(app).get('/api/customers/CUST-999/orders').expect(404);
  });
});
