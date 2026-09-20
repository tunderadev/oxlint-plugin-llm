// Reports what main has that the last release does not: feat and fix commits, and changes to
// runtime dependencies. Prints a markdown summary when a release is due and nothing otherwise.
// The release-pending workflow runs it weekly and turns the output into an issue.
// Set BASE_REF to compare against something other than the latest v* tag.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const git = (...args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

let base = process.env.BASE_REF ?? "";
if (base === "") {
  try {
    base = git("describe", "--tags", "--abbrev=0", "--match", "v*");
  } catch {
    // No release yet, so nothing is pending.
    process.exit(0);
  }
}

const userFacing = git("log", `${base}..HEAD`, "--format=%h %s")
  .split("\n")
  .filter((line) => /^\S+ (feat|fix)(\(|!|:)/u.test(line));

type Deps = Record<string, string>;
const runtimeDeps = (text: string): Deps => {
  const pkg = JSON.parse(text) as { dependencies?: Deps; peerDependencies?: Deps };
  return { ...pkg.dependencies, ...pkg.peerDependencies };
};
const before = runtimeDeps(git("show", `${base}:package.json`));
const after = runtimeDeps(readFileSync("package.json", "utf8"));
const depChanges = [...new Set([...Object.keys(before), ...Object.keys(after)])]
  .filter((name) => before[name] !== after[name])
  .map((name) => `${name}: ${before[name] ?? "(none)"} -> ${after[name] ?? "(removed)"}`);

if (userFacing.length === 0 && depChanges.length === 0) {
  process.exit(0);
}

const lines = [
  `main has changes since \`${base}\` that users would notice. Run \`pnpm release\`.`,
  "",
];
if (userFacing.length > 0) {
  lines.push("Commits that reach the changelog:", "", ...userFacing.map((c) => `- ${c}`), "");
}
if (depChanges.length > 0) {
  lines.push(
    "Runtime dependency changes, which move what users install:",
    "",
    ...depChanges.map((c) => `- ${c}`),
    "",
  );
}
lines.push("This issue is rewritten every week and closed once a release covers everything above.");
console.log(lines.join("\n"));
