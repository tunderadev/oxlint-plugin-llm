# Using this template

This repo is a GitHub template for Oxlint plugins. It is never published to npm itself.

1. On GitHub, press "Use this template" and name the new repo after the npm package, like `oxlint-plugin-llm`.
2. Clone it, then run the init script once:

   ```sh
   pnpm install
   pnpm init-template oxlint-plugin-llm "Lint rules for code that calls LLM SDKs." tunderadev
   ```

   It renames the package, the short name in `src/index.ts`, the README, CODEOWNERS, and SECURITY, drops `private`, and deletes itself and this file.

3. Replace `assets/logo.svg` with the project's mark.
4. Keep or delete the `no-fixme` example rule. `pnpm new-rule <name>` adds real ones.
5. Run the checks: `pnpm check && pnpm test && pnpm build && pnpm dogfood`.
6. Set up publishing, once:
   - Enable 2FA on npm (passkey; npm no longer offers authenticator apps).
   - `npm publish --access public` a 0.0.1 from your laptop. npm asks for the passkey in a browser window.
   - On npmjs.com, package settings, Trusted Publisher, GitHub Actions: your user, the repo name, workflow `publish.yml`, environment `release`. Allow `npm publish` for direct publishing.
   - Account settings, Publishing access: "Require two-factor authentication and disallow tokens".
   - On GitHub, create the `release` environment (Settings, Environments). No secrets go in it.
7. Install the pkg.pr.new and Renovate GitHub Apps on the repo, or delete `preview.yml` and `renovate.json`.
8. Enable Discussions and private vulnerability reporting in the repo settings. Create the labels: `bug`, `false positive`, `false negative`, `new rule`, `enhancement`, `good first issue`, `help wanted`, `documentation`.

Releasing after that is `pnpm release`.
