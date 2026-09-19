---
conclusion: neutral
alwaysApprove: ["pnpm-lock.yaml", ".node-version"]
neverApprove: [".github/workflows/publish.yml"]
---

Use Macroscope's default approvability criteria.

These need a human, even when the correctness check finds nothing:

- A new rule, or a change to what an existing rule reports: its message, its options, its default severity, or whether `recommended` includes it. People lint their code with these rules, so a change here changes what fails their builds.
- Any change to `exports` or `files` in `package.json`, or to `pnpm-workspace.yaml`. Those decide what ships to npm.
- A new or broadened directive that disables or suppresses a lint, type-checker, or other static-analysis diagnostic, at file, line, or configuration level. Suppressions in a lint plugin are a smell.

Test-only changes, pages under `docs/`, README edits, fixtures, and dependency bumps are fine to approve.
