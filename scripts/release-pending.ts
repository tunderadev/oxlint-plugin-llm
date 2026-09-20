// Reports what main has that the last release does not, and suggests the version bump.
// Prints a markdown summary when a release is due and nothing otherwise. The release-pending
// workflow turns the output into an issue. Set BASE_REF to compare against something other
// than the latest v* tag.
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

// Commits since the tag. Only feat and fix reach users; a `!` or a BREAKING CHANGE footer marks a break.
const commits = git("log", `${base}..HEAD`, "--format=%h %s").split("\n").filter(Boolean);
const feats = commits.filter((line) => /^\S+ feat(\(|!|:)/u.test(line));
const fixes = commits.filter((line) => /^\S+ fix(\(|!|:)/u.test(line));
const breaking =
  commits.some((line) => /^\S+ \w+(\([^)]*\))?!:/u.test(line)) ||
  /BREAKING CHANGE/u.test(git("log", `${base}..HEAD`, "--format=%B"));

// Runtime dependencies move what users install, so a change to their ranges counts too.
type Deps = Record<string, string>;
interface Pkg {
  version: string;
  dependencies?: Deps;
  peerDependencies?: Deps;
}
const runtimeDeps = (pkg: Pkg): Deps => ({ ...pkg.dependencies, ...pkg.peerDependencies });
const beforePkg = JSON.parse(git("show", `${base}:package.json`)) as Pkg;
const afterPkg = JSON.parse(readFileSync("package.json", "utf8")) as Pkg;
const before = runtimeDeps(beforePkg);
const after = runtimeDeps(afterPkg);
const majorOf = (range: string | undefined): string | null => /\d+/u.exec(range ?? "")?.[0] ?? null;
const changedDeps = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
  (name) => before[name] !== after[name],
);
const addedDeps = changedDeps.filter((name) => before[name] === undefined);
const depMajorMoved = changedDeps.some(
  (name) =>
    before[name] !== undefined &&
    after[name] !== undefined &&
    majorOf(before[name]) !== majorOf(after[name]),
);

if (feats.length === 0 && fixes.length === 0 && changedDeps.length === 0 && !breaking) {
  process.exit(0);
}

// Pick the bump. On 0.x a breaking change ships as a minor, which is how semver treats 0.x.
const version = afterPkg.version;
const [major, minor, patch] = version.split(".").map(Number);
let level: "major" | "minor" | "patch" = "patch";
const reasons: string[] = [];
if (breaking) {
  level = major === 0 ? "minor" : "major";
  reasons.push("a commit is marked breaking");
} else if (feats.length > 0 || depMajorMoved || addedDeps.length > 0) {
  level = "minor";
  if (feats.length > 0) reasons.push("there are new features");
  if (depMajorMoved) reasons.push("a runtime dependency moved to a new major");
  if (addedDeps.length > 0) reasons.push("a runtime dependency was added");
} else {
  if (fixes.length > 0) reasons.push("there are fixes");
  if (changedDeps.length > 0) reasons.push("a runtime dependency range changed");
}
const next = {
  major: `${major + 1}.0.0`,
  minor: `${major}.${minor + 1}.0`,
  patch: `${major}.${minor}.${patch + 1}`,
}[level];

const other = commits.length - feats.length - fixes.length;
const lines = [
  `**Suggested bump: ${level}, ${version} -> ${next}.** Run \`pnpm release ${level}\`.`,
  "",
  `Why ${level}: ${reasons.join(", ")}.${breaking && major === 0 ? " On 0.x a breaking change ships as a minor; go to 1.0.0 when the API is meant to hold." : ""}`,
  "",
];
if (feats.length > 0 || fixes.length > 0) {
  lines.push(
    `Commits since \`${base}\` that reach the changelog:`,
    "",
    ...[...feats, ...fixes].map((c) => `- ${c}`),
    "",
  );
}
if (changedDeps.length > 0) {
  lines.push(
    "Runtime dependency changes, which move what users install:",
    "",
    ...changedDeps.map((n) => `- ${n}: ${before[n] ?? "(none)"} -> ${after[n] ?? "(removed)"}`),
    "",
  );
}
if (other > 0) {
  lines.push(
    `Plus ${other} chore, docs, ci, or test commit(s) that do not need a release on their own.`,
    "",
  );
}
lines.push(
  "This issue refreshes on every push to main and every Monday, and closes once a release covers everything above.",
  "",
  "- [ ] <!-- rerun --> Check this box to refresh it right now.",
);
console.log(lines.join("\n"));
