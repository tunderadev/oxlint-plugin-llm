// Turn a fresh copy of the template into a real plugin repo.
// Usage: pnpm init-template <package-name> "<description>" [github-owner]
// Example: pnpm init-template oxlint-plugin-llm "Lint rules for code that calls LLM SDKs." tunderadev
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [pkg, description, owner = "tunderadev"] = process.argv.slice(2);

if (!pkg || !description) {
  console.error('Usage: pnpm init-template <package-name> "<description>" [github-owner]');
  process.exit(1);
}

const short = pkg.replace(/^(@[^/]+\/)?oxlint-plugin-/, "$1");
const root = process.cwd();

const replaceIn = (file: string, edits: [RegExp | string, string][]) => {
  const path = join(root, file);
  let text = readFileSync(path, "utf8");
  for (const [from, to] of edits) {
    text = typeof from === "string" ? text.replaceAll(from, to) : text.replace(from, to);
  }
  writeFileSync(path, text);
};

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
delete packageJson.private;
packageJson.name = pkg;
packageJson.description = description;
packageJson.homepage = `https://github.com/${owner}/${pkg}#readme`;
packageJson.bugs = { url: `https://github.com/${owner}/${pkg}/issues` };
packageJson.repository = { type: "git", url: `git+https://github.com/${owner}/${pkg}.git` };
packageJson.author = owner;
delete packageJson.scripts["init-template"];
writeFileSync(join(root, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);

replaceIn("src/index.ts", [
  ['export const name = "template"', `export const name = "${short}"`],
  ['jsPlugins: ["oxlint-plugin-template"]', `jsPlugins: ["${pkg}"]`],
]);
replaceIn("fixtures/oxlintrc.json", [["template/no-fixme", `${short}/no-fixme`]]);
replaceIn("docs/rules/no-fixme.md", [["# template/no-fixme", `# ${short}/no-fixme`]]);
replaceIn("README.md", [
  ["oxlint-plugin-template", pkg],
  ["__DESCRIPTION__", description],
  ["__OWNER__", owner],
  [/^# .*\n/m, `# ${pkg}\n`],
]);
replaceIn(".github/CODEOWNERS", [["tunderadev", owner]]);
replaceIn("CONTRIBUTING.md", [["oxlint-plugin-template", pkg]]);
replaceIn("SECURITY.md", [["tunderadev/oxlint-plugin-template", `${owner}/${pkg}`]]);

rmSync(join(root, "TEMPLATE.md"), { force: true });
rmSync(join(root, "scripts/init-template.ts"));

console.log(`Initialised ${pkg} (short name "${short}").
Next:
  1. Replace assets/logo.svg with this project's mark.
  2. Edit README.md: the pitch, the bullets, the rules table.
  3. pnpm install && pnpm check && pnpm test && pnpm build && pnpm dogfood
  4. Publish a 0.0.1 stub by hand, then add the trusted publisher on npmjs.com (see CONTRIBUTING.md).`);
