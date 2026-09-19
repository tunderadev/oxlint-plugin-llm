<img src="assets/logo.svg" width="96" align="right" alt="">

# oxlint-plugin-llm

[![npm version](https://img.shields.io/npm/v/oxlint-plugin-llm?style=flat&colorA=080f12&colorB=a78bfa)](https://npmjs.com/package/oxlint-plugin-llm)
[![npm downloads](https://img.shields.io/npm/dm/oxlint-plugin-llm?style=flat&colorA=080f12&colorB=a78bfa)](https://npmjs.com/package/oxlint-plugin-llm)
[![CI](https://github.com/tunderadev/oxlint-plugin-llm/actions/workflows/ci.yml/badge.svg)](https://github.com/tunderadev/oxlint-plugin-llm/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-080f12?style=flat&colorA=080f12&colorB=a78bfa)](LICENSE)

**Lint rules for code that calls LLM SDKs.** Vercel AI SDK (`ai`), `openai`, `@anthropic-ai/sdk`, and the MCP TypeScript SDK. Every rule reads one file's AST and needs no type information, so it runs at Oxlint speed.

It catches things like:

```ts
client.messages.create({ model, messages });
// anthropic-require-max-tokens: the API rejects this with a 400

streamText({ model, prompt });
// no-unconsumed-stream: nothing reads the stream, so nothing is sent

generateText({ model, maxTokens: 200 });
// no-deprecated-api: renamed to maxOutputTokens in ai 5

const res = await openai.chat.completions.create({ model, messages, stream: true });
res.choices[0];
// no-stream-result-as-response: res is a stream of events, choices is undefined

export async function POST(req: Request) {
  return streamText({ model, messages });
  // require-abort-signal-in-handlers: pass abortSignal: req.signal or pay for the whole answer
}
```

The rules match the SDK API, not your local names. `import { streamText as st }`, `import * as ai`, `require("ai")`, `new AzureOpenAI()` behind a class field: all of them resolve.

## Install

```sh
npm i -D oxlint oxlint-plugin-llm
pnpm add -D oxlint oxlint-plugin-llm
yarn add -D oxlint oxlint-plugin-llm
bun add -d oxlint oxlint-plugin-llm
```

## Use

`oxlint.config.ts`:

```ts
import { defineConfig } from "oxlint";
import llm from "oxlint-plugin-llm";

export default defineConfig({
  extends: [llm.configs.recommended],
});
```

Or `.oxlintrc.json`:

```json
{
  "jsPlugins": ["oxlint-plugin-llm"],
  "rules": {
    "llm/anthropic-require-max-tokens": "error",
    "llm/no-deprecated-api": "warn",
    "llm/no-unconsumed-stream": "error",
    "llm/no-stream-result-as-response": "error",
    "llm/require-abort-signal-in-handlers": "error"
  }
}
```

The same package loads in ESLint 9: `plugins: { llm }`.

Plugins cannot read `package.json`, so `no-deprecated-api` assumes the current majors. If you are pinned to an older one, say so and it only reports what applies:

```json
{
  "settings": {
    "llm": { "ai": 5, "openai": 6 }
  }
}
```

## Rules

🔧 has an autofix. ✅ is in `recommended`.

<!-- rules:start -->

| Rule                                                                               | What it flags                                                         | 🔧  | ✅  |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --- | --- |
| [anthropic-require-max-tokens](docs/rules/anthropic-require-max-tokens.md)         | `messages.create()` without `max_tokens`.                             |     | ✅  |
| [no-deprecated-api](docs/rules/no-deprecated-api.md)                               | Calls, options, and result fields deprecated in your SDK major.       | 🔧  | ✅  |
| [no-unconsumed-stream](docs/rules/no-unconsumed-stream.md)                         | A streaming call whose result nothing reads.                          |     | ✅  |
| [no-stream-result-as-response](docs/rules/no-stream-result-as-response.md)         | `.choices` or `.content` read on the result of a `stream: true` call. |     | ✅  |
| [require-abort-signal-in-handlers](docs/rules/require-abort-signal-in-handlers.md) | A generation call in a request handler with no abort signal.          |     | ✅  |

<!-- rules:end -->

## Not covered on purpose

Hardcoded API keys, user input in system prompts, and tools without schemas are already handled by `eslint-plugin-openai-security`, `eslint-plugin-anthropic-security`, `eslint-plugin-vercel-ai-security`, and `eslint-plugin-mcp-sdk-security`, which load in Oxlint too. This plugin does not repeat them. It covers what they leave out: renames and deprecations, stream misuse, and abort signals across all three SDKs.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). The short version: `pnpm new-rule <name>` scaffolds a rule with its test and doc page, PR titles are conventional commits, and issues labelled `good first issue` are a fine place to start.

## License

MIT
