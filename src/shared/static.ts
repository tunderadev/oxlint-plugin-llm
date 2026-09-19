import type { ESTree, SourceCode } from "@oxlint/plugins";
import { unwrap } from "./ast.ts";
import { findVariable, singleConstInit } from "./scope.ts";

type Node = ESTree.Node;

export interface StaticValue {
  value: unknown;
}

const MAX_DEPTH = 8;

/**
 * Evaluate an expression that has one possible value without running it.
 * Covers literals, template literals with no holes, `-x` and `!x` of those,
 * and a `const` with exactly one definition whose initializer is static.
 * Returns `null` when unsure. Bail rather than guess.
 */
export function getStaticValue(node: Node, sourceCode: SourceCode, depth = 0): StaticValue | null {
  if (depth > MAX_DEPTH) return null;
  const expression = unwrap(node);
  switch (expression.type) {
    case "Literal":
      return { value: expression.value };
    case "TemplateLiteral":
      if (expression.expressions.length !== 0) return null;
      return { value: expression.quasis[0]?.value.cooked ?? "" };
    case "UnaryExpression": {
      const inner = getStaticValue(expression.argument, sourceCode, depth + 1);
      if (!inner) return null;
      switch (expression.operator) {
        case "!":
          return { value: !inner.value };
        case "-":
          return typeof inner.value === "number" ? { value: -inner.value } : null;
        case "+":
          return typeof inner.value === "number" ? { value: inner.value } : null;
        case "typeof":
          return { value: typeof inner.value };
        default:
          return null;
      }
    }
    case "Identifier": {
      if (expression.name === "undefined") return { value: undefined };
      const variable = findVariable(sourceCode.getScope(expression), expression.name);
      const init = variable && singleConstInit(variable);
      return init ? getStaticValue(init, sourceCode, depth + 1) : null;
    }
    default:
      return null;
  }
}
