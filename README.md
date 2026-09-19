<img src="assets/logo.svg" width="96" align="right" alt="">

# oxlint-plugin-template

[![npm version](https://img.shields.io/npm/v/oxlint-plugin-template?style=flat&colorA=080f12&colorB=9ca3af)](https://npmjs.com/package/oxlint-plugin-template)
[![npm downloads](https://img.shields.io/npm/dm/oxlint-plugin-template?style=flat&colorA=080f12&colorB=9ca3af)](https://npmjs.com/package/oxlint-plugin-template)
[![CI](https://github.com/__OWNER__/oxlint-plugin-template/actions/workflows/ci.yml/badge.svg)](https://github.com/__OWNER__/oxlint-plugin-template/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-080f12?style=flat&colorA=080f12&colorB=9ca3af)](LICENSE)

**DESCRIPTION**

It catches things like:

```ts
// FIXME: handle empty input     ← no-fixme
```

## Install

```sh
npm i -D oxlint oxlint-plugin-template
pnpm add -D oxlint oxlint-plugin-template
yarn add -D oxlint oxlint-plugin-template
bun add -d oxlint oxlint-plugin-template
```

## Use

`oxlint.config.ts`:

```ts
import { defineConfig } from "oxlint";
import plugin from "oxlint-plugin-template";

export default defineConfig({
  extends: [plugin.configs.recommended],
});
```

Or `.oxlintrc.json`:

```json
{
  "jsPlugins": ["oxlint-plugin-template"],
  "rules": {
    "template/no-fixme": "warn"
  }
}
```

The same package loads in ESLint 9: `plugins: { template: plugin }`.

## Rules

🔧 has an autofix. ✅ is in `recommended`.

<!-- rules:start -->

| Rule                               | What it flags              | 🔧  | ✅  |
| ---------------------------------- | -------------------------- | --- | --- |
| [no-fixme](docs/rules/no-fixme.md) | Comments containing FIXME. |     | ✅  |

<!-- rules:end -->

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). The short version: `pnpm new-rule <name>` scaffolds a rule with its test and doc page, PR titles are conventional commits, and issues labelled `good first issue` are a fine place to start.

## License

MIT
