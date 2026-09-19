import type { ESTree, Scope, Variable } from "@oxlint/plugins";

/** Find the variable `name` resolves to from `scope`, walking outwards. */
export function findVariable(scope: Scope, name: string): Variable | null {
  for (let current: Scope | null = scope; current; current = current.upper) {
    const variable = current.set.get(name);
    if (variable) return variable;
  }
  return null;
}

/**
 * The initializer of a variable that is declared once, with `const`, and never reassigned.
 * Anything else returns `null`.
 */
export function singleConstInit(variable: Variable): ESTree.Expression | null {
  if (variable.defs.length !== 1) return null;
  const def = variable.defs[0]!;
  if (def.type !== "Variable") return null;
  const declarator = def.node as ESTree.VariableDeclarator;
  const declaration = def.parent as ESTree.VariableDeclaration | null;
  if (declaration?.kind !== "const" || declarator.id.type !== "Identifier") return null;
  return declarator.init;
}

/** The single declarator of a variable declared once with `const` or `let` and never reassigned. */
export function singleDeclarator(variable: Variable): ESTree.VariableDeclarator | null {
  if (variable.defs.length !== 1) return null;
  const def = variable.defs[0]!;
  if (def.type !== "Variable") return null;
  if (variable.references.filter((r) => r.isWrite()).length > 1) return null;
  return def.node as ESTree.VariableDeclarator;
}
