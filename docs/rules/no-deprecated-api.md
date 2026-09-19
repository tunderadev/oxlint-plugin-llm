# llm/no-deprecated-api

Flags calls, options, result fields, and imports that the SDK you use has deprecated or renamed.

The list lives in one file, `src/shared/sdk.ts`, with the major version that deprecated each name. An entry only fires when the configured major for that SDK is at or above it, so a project pinned to `ai` 5 does not get told about `ai` 7 renames.

## Settings

Plugins cannot read `package.json`, so tell the rule which majors you are on. Defaults are the current majors on 2026-09-19.

```json
{
  "settings": {
    "llm": { "ai": 7, "openai": 7, "anthropic": 0, "mcp": 2 }
  }
}
```

Only the keys you set are overridden.

## What it flags

`ai` (Vercel AI SDK):

| Since | Deprecated                                                                                                        | Use instead                                           | Fix |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --- |
| 5     | `maxTokens` option                                                                                                | `maxOutputTokens`                                     | 🔧  |
| 5     | `maxSteps` option                                                                                                 | `stopWhen: stepCountIs(n)`                            |     |
| 5     | `parameters` in `tool()`                                                                                          | `inputSchema`                                         | 🔧  |
| 5     | `CoreMessage`, `convertToCoreMessages` imports                                                                    | `ModelMessage`, `convertToModelMessages`              |     |
| 5     | `result.toDataStreamResponse()`                                                                                   | `toUIMessageStreamResponse()`, then the ai 7 helpers  |     |
| 6     | `generateObject()`, `streamObject()`                                                                              | `generateText()` and `streamText()` with `output`     |     |
| 7     | `system` option                                                                                                   | `instructions`                                        | 🔧  |
| 7     | `onFinish`, `onStepFinish`                                                                                        | `onEnd`, `onStepEnd`                                  | 🔧  |
| 7     | `experimental_telemetry`, `experimental_repairToolCall`, `experimental_include`, the `experimental_on*` callbacks | the same names without the prefix                     | 🔧  |
| 7     | `includeRawChunks`                                                                                                | `include: { rawChunks: true }`                        |     |
| 7     | `result.fullStream`, `result.experimental_partialOutputStream`                                                    | `result.stream`, `result.partialOutputStream`         | 🔧  |
| 7     | `result.toUIMessageStreamResponse()` and the other result-to-response methods                                     | the standalone helpers from `ai` with `result.stream` |     |

`openai`:

| Since | Deprecated                       | Use instead                                | Fix |
| ----- | -------------------------------- | ------------------------------------------ | --- |
| 4     | `functions`, `function_call`     | `tools`, `tool_choice`                     |     |
| 5     | `max_tokens` in chat completions | `max_completion_tokens`                    | 🔧  |
| 6     | `user`                           | `safety_identifier` and `prompt_cache_key` |     |
| 7     | `seed`                           | nothing, determinism was never guaranteed  |     |
| 7     | `prompt_cache_retention`         | `prompt_cache_options: { ttl }`            |     |

MCP TypeScript SDK:

| Since | Deprecated                                              | Use instead                                                | Fix |
| ----- | ------------------------------------------------------- | ---------------------------------------------------------- | --- |
| 1     | `server.tool()`, `server.prompt()`, `server.resource()` | `registerTool()`, `registerPrompt()`, `registerResource()` |     |

`@anthropic-ai/sdk` marks `temperature`, `top_k`, and `top_p` deprecated for models after Claude Opus 4.6. Older models still take them, and the rule cannot see the model, so it stays quiet.

## Examples

Bad:

```ts
import { generateText, streamText } from "ai";

await generateText({ model, system: "Be brief.", maxTokens: 200 });

const result = streamText({ model, prompt });
for await (const part of result.fullStream) {
}
```

Good:

```ts
await generateText({ model, instructions: "Be brief.", maxOutputTokens: 200 });

const result = streamText({ model, prompt });
for await (const part of result.stream) {
}
```

## Options

None. Versions come from `settings.llm`.

## Fixable

Yes, where the change is a rename that keeps the same value. Entries whose replacement has a different shape report without a fix.
