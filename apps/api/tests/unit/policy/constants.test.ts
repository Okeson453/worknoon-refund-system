import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY_CONFIG } from '../../../src/policy/policy.constants';
import { env } from '../../../src/config/env';

/**
 * policy/refund-policy.md is the human-readable contract. Its numbers must match the code, so a
 * reviewer never has to guess which source is authoritative.
 */
const policyDocument = readFileSync(resolve(__dirname, '../../../../../policy/refund-policy.md'), 'utf8');

describe('policy constants', () => {
  it('documents the refund window that the code uses', () => {
    expect(DEFAULT_POLICY_CONFIG.refundWindowDays).toBe(30);
    expect(policyDocument).toContain('30 days');
  });

  it('documents the human-review threshold that the code uses', () => {
    expect(DEFAULT_POLICY_CONFIG.escalationThresholdCents).toBe(50_000);
    expect(policyDocument).toContain('$500.00');
  });

  it('documents the minimum AI confidence that the code uses', () => {
    expect(DEFAULT_POLICY_CONFIG.minConfidence).toBe(0.6);
    expect(policyDocument).toContain('0.6');
  });

  it('reads the same values from the environment defaults', () => {
    expect(env.REFUND_WINDOW_DAYS).toBe(30);
    expect(env.ESCALATION_THRESHOLD_USD).toBe(500);
    expect(env.AI_MIN_CONFIDENCE).toBe(0.6);
  });
});
