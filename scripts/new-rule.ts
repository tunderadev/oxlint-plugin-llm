// Scaffold a rule: source, test, and doc page, and register it in src/index.ts
// and the README rules table. Usage: pnpm new-rule <rule-name> ["one-line description"]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [ruleName, description = "Describe what this rule flags."] = process.argv.slice(2);

if (!ruleName || !/^[a-z][a-z0-9-]*$/.test(ruleName)) {
  console.error(
    "Usage: pnpm new-rule <rule-name> [description]\nRule names are lowercase with dashes, like no-foo.",
  );
  process.exit(1);
}

const root = process.cwd();
const indexPath = join(root, "src/index.ts");
const readmePath = join(root, "README.md");
const rulePath = join(root, `src/rules/${ruleName}.ts`);
const testPath = join(root, `src/rules/${ruleName}.test.ts`);
const docPath = join(root, `docs/rules/${ruleName}.md`);

for (const path of [rulePath, testPath, docPath]) {
  if (existsSync(path)) {
    console.error(`Already exists: ${path}`);
    process.exit(1);
  }
}

const index = readFileSync(indexPath, "utf8");
const pluginName = /export const name = "([^"]+)"/.exec(index)?.[1] ?? "plugin";
const importName = ruleName.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

writeFileSync(
  rulePath,
  `import { defineRule } from "@oxlint/plugins";

export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: ${JSON.stringify(description)},
    },
    messages: {
      found: "TODO: write the message people will read in their editor.",
    },
    schema: [],
  },
  createOnce(context) {
    return {
      before() {
        // Return false to skip a file cheaply. JS plugins have no cache.
        return true;
      },
      // Replace with the node types this rule cares about.
      Identifier(node) {
        if (node.name === "TODO_REPLACE_ME") {
          context.report({ node, messageId: "found" });
        }
      },
    };
  },
});
`,
);

writeFileSync(
  testPath,
  `import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vite-plus/test";
import rule from "./${ruleName}.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "ts" } },
});

tester.run("${ruleName}", rule, {
  valid: ["const ok = 1;"],
  invalid: [
    {
      code: "const TODO_REPLACE_ME = 1;",
      errors: [{ messageId: "found" }],
    },
  ],
});
`,
);

writeFileSync(
  docPath,
  `# ${pluginName}/${ruleName}

${description}

## Examples

Bad:

\`\`\`ts
// TODO
\`\`\`

Good:

\`\`\`ts
// TODO
\`\`\`

## Options

None.

## Fixable

No.
`,
);

const importLine = `import ${importName} from "./rules/${ruleName}.ts";\n`;
// After the last existing rule import, or after the @oxlint/plugins import when this is the first rule.
const withImport = /import \w+ from "\.\/rules\//.test(index)
  ? index.replace(
      /(import \w+ from "\.\/rules\/[^"]+";\n)(?![\s\S]*import \w+ from "\.\/rules\/)/,
      `$1${importLine}`,
    )
  : index.replace(/(import \{[^}]*\} from "@oxlint\/plugins";\n)/, `$1${importLine}`);
const nextIndex = withImport
  .replace("// new-rule:end", `"${ruleName}": ${importName},\n  // new-rule:end`)
  .replace(
    "// new-rule:recommended:end",
    `[\`\${name}/${ruleName}\`]: "error",\n      // new-rule:recommended:end`,
  );
writeFileSync(indexPath, nextIndex);

if (existsSync(readmePath)) {
  const readme = readFileSync(readmePath, "utf8");
  const row = `| [${ruleName}](docs/rules/${ruleName}.md) | ${description} |  | ✅ |`;
  // oxfmt leaves a blank line before the end marker; the row must stay inside the table.
  writeFileSync(
    readmePath,
    readme.replace(/\n*<!-- rules:end -->/, `\n${row}\n<!-- rules:end -->`),
  );
}

console.log(
  `Created ${ruleName}:\n  ${rulePath}\n  ${testPath}\n  ${docPath}\nRegistered in src/index.ts and README.md. Run: pnpm fix && pnpm test`,
);
