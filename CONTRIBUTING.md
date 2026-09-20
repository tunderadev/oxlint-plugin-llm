# Contributing

Thanks for looking. This file is short on purpose.

## Setup

Node 22 or newer and pnpm. If you have [Vite+](https://viteplus.dev) installed, `vp install` also pins both for you.

```sh
pnpm install
pnpm test       # vitest, through vp test
pnpm check      # format, lint, and type check in one pass
pnpm fix        # same, with autofixes applied
pnpm build      # dist/ via tsdown
pnpm dogfood    # runs real oxlint over fixtures/ with the built plugin
```

## Adding a rule

```sh
pnpm new-rule no-foo "Flag foo because bar."
```

That writes `src/rules/no-foo.ts`, its test, `docs/rules/no-foo.md`, and registers the rule in `src/index.ts` and the README table. Fill in the visitor, the message, and the examples. Every rule ships with valid and invalid test cases.

Rules use `defineRule` with `createOnce` from `@oxlint/plugins`. Return `false` from `before()` when a file cannot match, since JS plugins have no cache. Files lint in parallel, so keep state inside `createOnce` and reset it in `before()`.

## Pull requests

PRs are squash-merged. The title becomes the commit and the changelog line, so write it as a conventional commit:

```
feat(no-foo): add ignore option
fix(no-foo): handle block comments
docs: fix typo in README
```

Only `feat` and `fix` show up in release notes. A CI check enforces the format.

A ruleset on `main` requires green CI before anything merges. Bots review every PR too: CodeRabbit and Macroscope leave comments and approve when they find nothing. Their approval is advice for the maintainer, not a merge gate. A human still merges PRs from people.

Open an issue before a large change so we can agree on the shape first. Small fixes can go straight to a PR.

## Dependencies

Renovate opens dependency PRs and merges them itself once CI passes. Only majors of runtime dependencies wait for a human, since those change what users install. The Dependency Dashboard issue lists anything it is holding back.

If an AI tool wrote part of your change, say so in the PR. That is fine. What is not fine is a PR you cannot explain line by line, or an issue or PR description written for you.

## Releases

Releases are manual and have no schedule. One is due when main has something a user would notice since the last tag: a `feat` or `fix` commit, or a change to a runtime dependency. A weekly workflow checks for that and opens a "release pending" issue when it finds something. Dev dependency bumps, docs, and CI changes never need a release on their own.

Maintainers run `pnpm release`. That bumps the version, tags, and pushes. The tag triggers `publish.yml`, which publishes to npm through trusted publishing and writes the GitHub release from the commit titles since the last tag.
