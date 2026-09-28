import { describe, expect, it } from 'vitest';
import { customerIdParamSchema } from '../../../src/validation/customer.schemas';
import { toFieldErrors } from '../../../src/validation/common.schemas';
import { createRefundRequestSchema } from '../../../src/validation/refund.schemas';

describe('customerIdParamSchema', () => {
  it('accepts a seeded customer id', () => {
    expect(customerIdParamSchema.safeParse({ id: 'CUST-007' }).success).toBe(true);
  });

  it.each(['', 'CUST 007', '../../etc/passwd', 'a'.repeat(65)])('rejects %s', (id) => {
    expect(customerIdParamSchema.safeParse({ id }).success).toBe(false);
  });

  it('rejects a missing id', () => {
    expect(customerIdParamSchema.safeParse({}).success).toBe(false);
  });
});

describe('field error mapping', () => {
  it('produces customer-safe path and message pairs', () => {
    const parsed = createRefundRequestSchema.safeParse({ customerId: 'CUST-007', orderId: 'ORD-1007', itemIds: [], message: '  ' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const errors = toFieldErrors(parsed.error);
    expect(errors).toEqual(
      expect.arrayContaining([
        { path: 'itemIds', message: 'Select at least one item.' },
        { path: 'message', message: 'A message is required.' },
      ]),
    );
    expect(errors.every((error) => !error.message.includes('ZodError'))).toBe(true);
  });
});
