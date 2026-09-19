// Apply the GitHub settings the workflows assume: squash-only merges with the PR
// title as the commit, auto-merge on, and a ruleset on main that requires green
// CI before anything merges. Renovate needs the last two to merge its own PRs.
// Admins bypass the ruleset so `pnpm release` can still push straight to main.
// Re-run it whenever the required checks change. Needs `gh auth login`.
// Usage: pnpm setup-repo [owner/repo]
import { execFileSync } from "node:child_process";

const gh = (method: "GET" | "PATCH" | "POST" | "PUT", path: string, body?: unknown) => {
  const args = ["api", "-X", method, path];
  if (body) args.push("--input", "-");
  const out = execFileSync("gh", args, {
    encoding: "utf8",
    input: body ? JSON.stringify(body) : undefined,
    stdio: ["pipe", "pipe", "inherit"],
  });
  return out ? JSON.parse(out) : undefined;
};

const repo =
  process.argv[2] ??
  execFileSync("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], {
    encoding: "utf8",
  }).trim();

const GITHUB_ACTIONS_APP_ID = 15368;
const REPOSITORY_ROLE_ADMIN = 5;

// Job ids from ci.yml and pr-title.yml, as GitHub names the check runs.
const requiredChecks = ["test (22)", "test (24)", "title"];

const ruleset = {
  name: "main",
  target: "branch",
  enforcement: "active",
  conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
  bypass_actors: [
    { actor_id: REPOSITORY_ROLE_ADMIN, actor_type: "RepositoryRole", bypass_mode: "always" },
  ],
  rules: [
    { type: "deletion" },
    { type: "non_fast_forward" },
    {
      type: "required_status_checks",
      parameters: {
        strict_required_status_checks_policy: false,
        required_status_checks: requiredChecks.map((context) => ({
          context,
          integration_id: GITHUB_ACTIONS_APP_ID,
        })),
      },
    },
  ],
};

gh("PATCH", `repos/${repo}`, {
  allow_auto_merge: true,
  allow_squash_merge: true,
  allow_merge_commit: false,
  allow_rebase_merge: false,
  delete_branch_on_merge: true,
  squash_merge_commit_title: "PR_TITLE",
  squash_merge_commit_message: "PR_BODY",
});
console.log(`${repo}: squash-only merges, auto-merge on, branches deleted on merge`);

const existing = (gh("GET", `repos/${repo}/rulesets`) as { id: number; name: string }[]).find(
  (r) => r.name === ruleset.name,
);
if (existing) {
  gh("PUT", `repos/${repo}/rulesets/${existing.id}`, ruleset);
} else {
  gh("POST", `repos/${repo}/rulesets`, ruleset);
}
console.log(
  `${repo}: ruleset "main" ${existing ? "updated" : "created"}, requires ${requiredChecks.join(", ")}`,
);
