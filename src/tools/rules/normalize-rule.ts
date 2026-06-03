// ----------------------------
// RULE INPUT NORMALIZATION
// ----------------------------

/**
 * Shape of a single rule condition as accepted by the MCP tool.
 */
interface RuleCondition {
  field?: unknown;
  op?: unknown;
  value?: unknown;
  [key: string]: unknown;
}

/**
 * The `{ num1, num2 }` object shape expected by `@actual-app/api` for the
 * `isbetween` condition operator.
 */
interface BetweenValue {
  num1: unknown;
  num2: unknown;
}

/**
 * Convert an `isbetween` condition value from the ergonomic MCP array form
 * `[a, b]` into the `{ num1: a, num2: b }` object that `@actual-app/api`
 * expects.
 *
 * The MCP tool documents `isbetween` values as a two-element array, but the
 * Actual Budget API validator only accepts `{ num1, num2 }` (which is also how
 * `get-rules` returns them). If the value is already in object form, or is not
 * a two-element array, it is returned unchanged so callers may also pass the
 * native shape.
 *
 * @param value - The raw condition value supplied to the tool.
 * @returns The normalized `{ num1, num2 }` value, or the original value when no
 *   conversion applies.
 */
function normalizeBetweenValue(value: unknown): unknown {
  if (Array.isArray(value) && value.length === 2) {
    const [num1, num2] = value;
    return { num1, num2 } satisfies BetweenValue;
  }

  return value;
}

/**
 * Normalize a rule's conditions so `isbetween` operators carry a `{ num1, num2 }`
 * value instead of the array form documented by the MCP tool schema.
 *
 * Returns a shallow-cloned args object with normalized conditions; the input is
 * not mutated. Non-`isbetween` conditions and any args without a `conditions`
 * array are passed through untouched.
 *
 * @param args - The raw arguments passed to `create-rule` / `update-rule`.
 * @returns A new args object with normalized `isbetween` condition values.
 */
export function normalizeRuleArgs(args: Record<string, unknown>): Record<string, unknown> {
  const { conditions } = args;

  if (!Array.isArray(conditions)) {
    return args;
  }

  const normalizedConditions = conditions.map((condition) => {
    if (condition && typeof condition === 'object') {
      const cond = condition as RuleCondition;
      if (cond.op === 'isbetween') {
        return { ...cond, value: normalizeBetweenValue(cond.value) };
      }
    }
    return condition;
  });

  return { ...args, conditions: normalizedConditions };
}
