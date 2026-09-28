import { describe, expect, it } from 'vitest';
import { evaluateApprovalRules } from '../../../src/policy/rules/approvalRules';
import { makeInput, makeItem, makeSignals } from '../../fixtures/refundScenarios';

function findRule(input: Parameters<typeof evaluateApprovalRules>[0], code: string) {
  const rule = evaluateApprovalRules(input).find((check) => check.code === code);
  if (rule === undefined) throw new Error(`rule ${code} missing`);
  return rule;
}

describe('A1 VERIFIED_DEFECT', () => {
  it('fires when damage is confirmed on the record', () => {
    const input = makeInput({ items: [makeItem({ damaged: true })], signals: makeSignals({ reason: 'DAMAGED' }) });
    expect(findRule(input, 'VERIFIED_DEFECT').fired).toBe(true);
  });

  it('fires when a wrong item is confirmed on the record', () => {
    const input = makeInput({ items: [makeItem({ incorrectItem: true })], signals: makeSignals({ reason: 'INCORRECT_ITEM' }) });
    expect(findRule(input, 'VERIFIED_DEFECT').fired).toBe(true);
  });

  it('does not fire when the record does not confirm the claim', () => {
    const input = makeInput({ items: [makeItem()], signals: makeSignals({ reason: 'DAMAGED' }) });
    expect(findRule(input, 'VERIFIED_DEFECT').fired).toBe(false);
  });

  it('does not fire when only some of several items are confirmed', () => {
    const input = makeInput({
      items: [makeItem({ damaged: true }), makeItem({ id: 'ITM-TEST-2', name: 'Other' })],
      signals: makeSignals({ reason: 'DAMAGED' }),
    });
    expect(findRule(input, 'VERIFIED_DEFECT').fired).toBe(false);
  });
});

describe('A2 STANDARD_RETURN', () => {
  it('fires for a change of mind', () => {
    const input = makeInput({ items: [makeItem()], signals: makeSignals({ reason: 'CHANGED_MIND' }) });
    expect(findRule(input, 'STANDARD_RETURN').fired).toBe(true);
  });

  it('does not fire for a damage claim', () => {
    expect(findRule(makeInput(), 'STANDARD_RETURN').fired).toBe(false);
  });
});
