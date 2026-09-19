import { defineRule, type ESTree, type FixFn } from "@oxlint/plugins";
import { keyName, memberName, unwrap } from "../shared/ast.ts";
import { SdkFile, type Resolved } from "../shared/imports.ts";
import { DEPRECATIONS, sdkForSource, type Deprecation } from "../shared/sdk.ts";
import { readVersions } from "../shared/settings.ts";

type Option = Extract<Deprecation, { kind: "option" }>;
type Member = Extract<Deprecation, { kind: "member" }>;
type Call = Extract<Deprecation, { kind: "call" }>;
type Import = Extract<Deprecation, { kind: "import" }>;

function groupByName<T extends { name: string }>(entries: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const entry of entries) {
    const list = map.get(entry.name);
    if (list) list.push(entry);
    else map.set(entry.name, [entry]);
  }
  return map;
}

export default defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Flag SDK calls, options, and result fields that are deprecated in the SDK major you use.",
    },
    messages: {
      deprecated: "{{detail}}",
    },
    fixable: "code",
    schema: [],
  },
  createOnce(context) {
    const file = new SdkFile(context);
    let calls: Call[] = [];
    let options = new Map<string, Option[]>();
    let members = new Map<string, Member[]>();
    let imports = new Map<string, Import[]>();

    const renameKey = (property: ESTree.ObjectProperty, to: string): FixFn | undefined => {
      const key = property.key;
      if (property.shorthand) {
        const value = context.sourceCode.getText(property.value);
        return (fixer) => fixer.replaceText(property, `${to}: ${value}`);
      }
      if (!property.computed && key.type === "Identifier") {
        return (fixer) => fixer.replaceText(key, to);
      }
      if (key.type === "Literal" && typeof key.value === "string") {
        const quote = key.raw?.[0] ?? '"';
        return (fixer) => fixer.replaceText(key, `${quote}${to}${quote}`);
      }
      return undefined;
    };

    const matchesAny = (resolved: Resolved, entry: Option) =>
      entry.on.some((path) =>
        file.matchesResolved(resolved, { sdk: entry.sdk, path, loose: entry.loose }),
      );

    return {
      before() {
        if (!file.reset()) return false;
        const versions = readVersions(context.settings);
        const active = DEPRECATIONS.filter(
          (entry) => file.has(entry.sdk) && versions[entry.sdk] >= entry.since,
        );
        calls = active.filter((entry): entry is Call => entry.kind === "call");
        options = groupByName(active.filter((entry): entry is Option => entry.kind === "option"));
        members = groupByName(active.filter((entry): entry is Member => entry.kind === "member"));
        imports = groupByName(active.filter((entry): entry is Import => entry.kind === "import"));
        return active.length > 0;
      },

      ImportSpecifier(node) {
        if (imports.size === 0) return;
        const imported = node.imported;
        const name = imported.type === "Identifier" ? imported.name : imported.value;
        const candidates = imports.get(name);
        if (!candidates) return;
        const sdk = sdkForSource((node.parent as ESTree.ImportDeclaration).source.value);
        for (const entry of candidates) {
          if (entry.sdk === sdk) {
            context.report({ node, messageId: "deprecated", data: { detail: entry.message } });
          }
        }
      },

      CallExpression(node) {
        const [first] = node.arguments;
        const params = first && unwrap(first);
        const object = params?.type === "ObjectExpression" ? params : null;

        // Cheap test before resolving: does the options object hold any deprecated key at all?
        let suspects: [ESTree.ObjectProperty, Option[]][] = [];
        if (object && options.size > 0) {
          for (const property of object.properties) {
            if (property.type !== "Property") continue;
            const name = keyName(property.key, property.computed);
            const entries = name === null ? undefined : options.get(name);
            if (entries) suspects.push([property, entries]);
          }
        }
        if (suspects.length === 0 && calls.length === 0) return;

        const resolved = file.resolve(node.callee);
        for (const entry of calls) {
          if (file.matchesResolved(resolved, entry)) {
            context.report({
              node: node.callee,
              messageId: "deprecated",
              data: { detail: entry.message },
            });
          }
        }
        for (const [property, entries] of suspects) {
          const entry = entries.find((candidate) => matchesAny(resolved, candidate));
          if (!entry) continue;
          context.report({
            node: property.key,
            messageId: "deprecated",
            data: { detail: entry.message },
            fix: entry.renameTo ? renameKey(property, entry.renameTo) : undefined,
          });
        }
      },

      MemberExpression(node) {
        if (members.size === 0) return;
        const name = memberName(node);
        const candidates = name === null ? undefined : members.get(name);
        if (!candidates) return;
        const resolved = file.resolve(node.object);
        const entry = candidates.find((candidate) =>
          file.matchesResolved(resolved, { sdk: candidate.sdk, path: candidate.on }),
        );
        if (!entry) return;
        const property = node.property;
        context.report({
          node: property,
          messageId: "deprecated",
          data: { detail: entry.message },
          fix:
            entry.renameTo && !node.computed
              ? (fixer) => fixer.replaceText(property, entry.renameTo!)
              : undefined,
        });
      },
    };
  },
});
