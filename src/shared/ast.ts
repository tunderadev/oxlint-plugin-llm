import type { ESTree, SourceCode } from "@oxlint/plugins";

type Node = ESTree.Node;
type Expression = ESTree.Expression;

/** Strip parentheses, TS casts, and optional chain wrappers. */
export function unwrap(node: Node): Node {
  let current = node;
  for (;;) {
    switch (current.type) {
      case "ParenthesizedExpression":
      case "ChainExpression":
        current = current.expression;
        break;
      case "TSAsExpression":
      case "TSSatisfiesExpression":
      case "TSNonNullExpression":
      case "TSTypeAssertion":
      case "TSInstantiationExpression":
        current = current.expression;
        break;
      default:
        return current;
    }
  }
}

/** `unwrap`, and also step through `await`. */
export function unwrapAwait(node: Node): Node {
  let current = unwrap(node);
  while (current.type === "AwaitExpression") current = unwrap(current.argument);
  return current;
}

/** Walk up through the wrappers `unwrap` strips, plus `await`, to the node that uses this value. */
export function outerParent(node: Node): Node {
  let current = node.parent as Node;
  for (;;) {
    switch (current.type) {
      case "ParenthesizedExpression":
      case "ChainExpression":
      case "TSAsExpression":
      case "TSSatisfiesExpression":
      case "TSNonNullExpression":
      case "TSTypeAssertion":
      case "TSInstantiationExpression":
      case "AwaitExpression":
        current = current.parent as Node;
        break;
      default:
        return current;
    }
  }
}

/** Name of a non-computed key, or a computed string literal key. */
export function keyName(key: ESTree.PropertyKey, computed: boolean): string | null {
  if (!computed && key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return null;
}

/** Name of a static member access, `a.b` or `a["b"]`. */
export function memberName(node: ESTree.MemberExpression): string | null {
  if (node.type !== "MemberExpression") return null;
  if (!node.computed) return node.property.type === "Identifier" ? node.property.name : null;
  const property = node.property as Expression;
  return property.type === "Literal" && typeof property.value === "string" ? property.value : null;
}

export function isObjectLiteral(node: Node | undefined): node is ESTree.ObjectExpression {
  return node !== undefined && unwrap(node).type === "ObjectExpression";
}

export function hasSpread(object: ESTree.ObjectExpression): boolean {
  return object.properties.some((p) => p.type === "SpreadElement");
}

export function getProperty(
  object: ESTree.ObjectExpression,
  name: string,
): ESTree.ObjectProperty | null {
  for (const property of object.properties) {
    if (property.type === "Property" && keyName(property.key, property.computed) === name) {
      return property;
    }
  }
  return null;
}

type FunctionNode = ESTree.Function | ESTree.ArrowFunctionExpression;

export function isFunction(node: Node): node is FunctionNode {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}

/** Every function that encloses `node`, innermost first. */
export function* enclosingFunctions(node: Node): Generator<FunctionNode> {
  let current = node.parent as Node | null;
  while (current) {
    if (isFunction(current)) yield current;
    current = current.parent as Node | null;
  }
}

/** Short label for a callee, like `streamText()` or `client.messages.create()`, for messages. */
export function calleeLabel(callee: Node, sourceCode: SourceCode): string {
  const text = sourceCode.getText(callee);
  return `${text.length > 40 ? `…${text.slice(-40)}` : text}()`;
}
