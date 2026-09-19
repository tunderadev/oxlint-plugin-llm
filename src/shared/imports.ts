// Resolve any expression to the SDK export it comes from, regardless of how
// the file imported it. `import { streamText as st } from "ai"`, `import * as ai`,
// `const { streamText } = require("ai")`, and `const client = new OpenAI()` all
// resolve to the same module-level path, so rules match the API and not the
// local name. Same idea as eslint-plugin-security's getImportAccessPath.
import type { Context, ESTree, SourceCode } from "@oxlint/plugins";
import { unwrap } from "./ast.ts";
import { findVariable, singleDeclarator } from "./scope.ts";
import { SDK_IMPORT_PATTERN, SDKS, sdkForSource, type CallPattern, type SdkId } from "./sdk.ts";

type Node = ESTree.Node;

/**
 * Where an expression comes from.
 *
 * - `sdk` is an SDK id when the root of the expression is an import from that SDK.
 * - `sdk` is `"other"` when the root is something known and not an SDK: another import,
 *   a class, a function. Never matched.
 * - `sdk` is `null` when the root cannot be resolved: `this`, a parameter, a call result.
 *   Then `path` is just the member chain, and `loose` patterns may match its tail.
 *
 * `path` segments are export and property names. `"()"` marks a call or `new`.
 */
export interface Resolved {
  sdk: SdkId | "other" | null;
  path: string[];
}

const OTHER: Resolved = { sdk: "other", path: [] };
const MAX_DEPTH = 10;
const CALL = "()";

const patternCache = new Map<string, string[]>();

/** `"OpenAI().chat.completions.create"` to `["OpenAI", "()", "chat", "completions", "create"]`. */
export function parsePath(path: string): string[] {
  let segments = patternCache.get(path);
  if (!segments) {
    segments = path
      .split(".")
      .flatMap((segment) =>
        segment.endsWith(CALL) ? [segment.slice(0, -CALL.length), CALL] : [segment],
      );
    patternCache.set(path, segments);
  }
  return segments;
}

function endsWith(path: string[], tail: string[]): boolean {
  if (tail.length > path.length) return false;
  const offset = path.length - tail.length;
  return tail.every((segment, i) => path[offset + i] === segment);
}

function sameSegments(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((segment, i) => segment === b[i]);
}

/** Per-file state shared by all rules: which SDKs the file imports, and a resolver. */
export class SdkFile {
  readonly imports = new Set<SdkId>();
  private sourceCode!: SourceCode;

  constructor(private readonly context: Context) {}

  /**
   * Call from `before()`. Rescans the file's imports and returns whether any SDK is imported.
   * Rules return this from `before()` so files without an SDK cost one regex test.
   */
  reset(): boolean {
    this.sourceCode = this.context.sourceCode;
    this.imports.clear();
    if (!SDK_IMPORT_PATTERN.test(this.sourceCode.text)) return false;
    for (const statement of this.sourceCode.ast.body) {
      if (statement.type === "ImportDeclaration") {
        this.add(statement.source.value);
      } else if (statement.type === "VariableDeclaration") {
        for (const declarator of statement.declarations) {
          const source = declarator.init && requireSource(unwrap(declarator.init));
          if (source !== null) this.add(source);
        }
      }
    }
    return this.imports.size > 0;
  }

  has(sdk: SdkId): boolean {
    return this.imports.has(sdk);
  }

  private add(source: string): void {
    const sdk = sdkForSource(source);
    if (sdk) this.imports.add(sdk);
  }

  resolve(node: Node): Resolved {
    return this.resolveAt(node, 0);
  }

  /** Whether `node` is the pattern, either exactly or by a loose tail match. */
  matches(node: Node, pattern: CallPattern): boolean {
    return this.matchesResolved(this.resolve(node), pattern);
  }

  matchesResolved(resolved: Resolved, pattern: CallPattern): boolean {
    const segments = parsePath(pattern.path);
    if (resolved.sdk === pattern.sdk) return sameSegments(resolved.path, segments);
    if (resolved.sdk !== null || !pattern.loose || !this.imports.has(pattern.sdk)) return false;
    const callIndex = segments.lastIndexOf(CALL);
    if (callIndex === -1) return false;
    const tail = segments.slice(callIndex + 1);
    // One segment, like `.create`, is too common to match on its own.
    return tail.length >= 2 && endsWith(resolved.path, tail);
  }

  /** First pattern that matches `node`, or `null`. */
  match<P extends CallPattern>(node: Node, patterns: readonly P[]): P | null {
    const resolved = this.resolve(node);
    for (const pattern of patterns) {
      if (this.matchesResolved(resolved, pattern)) return pattern;
    }
    return null;
  }

  private resolveAt(node: Node, depth: number): Resolved {
    if (depth > MAX_DEPTH) return OTHER;
    const expression = unwrap(node);
    switch (expression.type) {
      case "Identifier":
        return this.resolveIdentifier(expression as ESTree.IdentifierReference, depth);
      case "ThisExpression":
        return { sdk: null, path: [] };
      case "AwaitExpression":
        return this.resolveAt(expression.argument, depth + 1);
      case "MemberExpression": {
        const name = memberSegment(expression);
        if (name === null) return OTHER;
        const object = this.resolveAt(expression.object, depth + 1);
        if (object.sdk === "other") return OTHER;
        return { sdk: object.sdk, path: normalize(object.sdk, [...object.path, name]) };
      }
      case "CallExpression": {
        const source = requireSource(expression);
        if (source !== null) {
          const sdk = sdkForSource(source);
          return sdk ? { sdk, path: [] } : OTHER;
        }
        const callee = this.resolveAt(expression.callee, depth + 1);
        if (callee.sdk === "other") return OTHER;
        if (callee.sdk === null && callee.path.length === 0) return { sdk: null, path: [] };
        return { sdk: callee.sdk, path: [...callee.path, CALL] };
      }
      case "NewExpression": {
        const callee = this.resolveAt(expression.callee, depth + 1);
        if (callee.sdk === "other") return OTHER;
        if (callee.sdk === null) return { sdk: null, path: [] };
        return { sdk: callee.sdk, path: [...instanceRoot(callee.sdk, callee.path), CALL] };
      }
      default:
        return OTHER;
    }
  }

  private resolveIdentifier(node: ESTree.IdentifierReference, depth: number): Resolved {
    const variable = findVariable(this.sourceCode.getScope(node), node.name);
    if (!variable) return { sdk: null, path: [] };
    if (variable.defs.length !== 1) return OTHER;
    const def = variable.defs[0]!;
    switch (def.type) {
      case "ImportBinding": {
        const declaration = def.parent as ESTree.ImportDeclaration;
        const sdk = sdkForSource(declaration.source.value);
        if (!sdk) return OTHER;
        return { sdk, path: normalize(sdk, importedPath(def.node as ImportSpecifier, sdk)) };
      }
      case "Variable": {
        const declarator = singleDeclarator(variable);
        if (!declarator?.init) return OTHER;
        if (declarator.id.type === "Identifier") return this.resolveAt(declarator.init, depth + 1);
        if (declarator.id.type === "ObjectPattern") {
          const key = destructuredKey(declarator.id, node.name);
          if (key === null) return OTHER;
          const init = this.resolveAt(declarator.init, depth + 1);
          if (init.sdk === "other") return OTHER;
          return { sdk: init.sdk, path: normalize(init.sdk, [...init.path, key]) };
        }
        return OTHER;
      }
      case "Parameter":
        return { sdk: null, path: [] };
      default:
        return OTHER;
    }
  }
}

type ImportSpecifier =
  | ESTree.ImportSpecifier
  | ESTree.ImportDefaultSpecifier
  | ESTree.ImportNamespaceSpecifier;

function importedPath(specifier: ImportSpecifier, sdk: SdkId): string[] {
  switch (specifier.type) {
    case "ImportNamespaceSpecifier":
      return [];
    case "ImportDefaultSpecifier":
      return [SDKS[sdk].defaultExport ?? "default"];
    case "ImportSpecifier": {
      const imported = specifier.imported;
      return [imported.type === "Identifier" ? imported.name : imported.value];
    }
  }
}

/** Fold `default` and class aliases into the SDK's canonical class name. */
function normalize(sdk: SdkId | null, path: string[]): string[] {
  if (sdk === null || path.length === 0) return path;
  const info = SDKS[sdk];
  const first = path[0]!;
  const canonical =
    first === "default" ? info.defaultExport : (info.classAliases?.[first] ?? first);
  if (canonical === undefined || canonical === first) return path;
  return [canonical, ...path.slice(1)];
}

/** `new X()` where X is the namespace or the client class becomes `[Client]`. */
function instanceRoot(sdk: SdkId, path: string[]): string[] {
  const { defaultExport } = SDKS[sdk];
  if (defaultExport && path.length === 0) return [defaultExport];
  return path;
}

function memberSegment(node: ESTree.MemberExpression): string | null {
  if (node.type !== "MemberExpression") return null;
  if (!node.computed) return node.property.type === "Identifier" ? node.property.name : null;
  const property = node.property as ESTree.Expression;
  return property.type === "Literal" && typeof property.value === "string" ? property.value : null;
}

/** `require("pkg")` to `"pkg"`, else `null`. */
function requireSource(node: Node): string | null {
  if (node.type !== "CallExpression") return null;
  const { callee } = node;
  if (callee.type !== "Identifier" || callee.name !== "require") return null;
  const [argument] = node.arguments;
  return argument?.type === "Literal" && typeof argument.value === "string" ? argument.value : null;
}

/** In `const { a: b } = x`, the key `a` for local name `b`. */
function destructuredKey(pattern: ESTree.ObjectPattern, local: string): string | null {
  for (const property of pattern.properties) {
    if (property.type !== "Property") continue;
    let value: ESTree.BindingPattern = property.value;
    if (value.type === "AssignmentPattern") value = value.left;
    if (value.type !== "Identifier" || value.name !== local) continue;
    if (!property.computed && property.key.type === "Identifier") return property.key.name;
    if (property.key.type === "Literal" && typeof property.key.value === "string") {
      return property.key.value;
    }
    return null;
  }
  return null;
}
