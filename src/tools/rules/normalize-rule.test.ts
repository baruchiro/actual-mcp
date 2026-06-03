import { describe, it, expect } from 'vitest';
import { normalizeRuleArgs } from './normalize-rule.js';

describe('normalizeRuleArgs', () => {
  it('converts an isbetween amount condition array to { num1, num2 }', () => {
    const args = {
      stage: null,
      conditionsOp: 'and',
      conditions: [
        { field: 'imported_payee', op: 'is', value: 'Acme' },
        { field: 'amount', op: 'isbetween', value: [-1, -99999] },
      ],
      actions: [{ field: 'payee', op: 'set', value: '' }],
    };

    const result = normalizeRuleArgs(args);

    expect(result.conditions).toEqual([
      { field: 'imported_payee', op: 'is', value: 'Acme' },
      { field: 'amount', op: 'isbetween', value: { num1: -1, num2: -99999 } },
    ]);
    // The original args object is not mutated.
    expect(args.conditions[1].value).toEqual([-1, -99999]);
  });

  it('leaves an isbetween value already in { num1, num2 } object form unchanged', () => {
    const args = {
      conditions: [{ field: 'amount', op: 'isbetween', value: { num1: -20000, num2: -40000 } }],
    };

    const result = normalizeRuleArgs(args);

    expect(result.conditions).toEqual([{ field: 'amount', op: 'isbetween', value: { num1: -20000, num2: -40000 } }]);
  });

  it('does not touch non-isbetween conditions or args without conditions', () => {
    const withOtherOps = {
      conditions: [
        { field: 'amount', op: 'lt', value: 0 },
        { field: 'category', op: 'oneOf', value: ['a', 'b'] },
      ],
    };
    expect(normalizeRuleArgs(withOtherOps)).toEqual(withOtherOps);

    const withoutConditions = { stage: null, actions: [] };
    expect(normalizeRuleArgs(withoutConditions)).toBe(withoutConditions);
  });

  it('leaves a malformed isbetween value (not a two-element array) unchanged', () => {
    const args = {
      conditions: [{ field: 'amount', op: 'isbetween', value: [42] }],
    };

    const result = normalizeRuleArgs(args);

    expect(result.conditions).toEqual([{ field: 'amount', op: 'isbetween', value: [42] }]);
  });
});
