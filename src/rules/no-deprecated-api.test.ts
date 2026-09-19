import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vite-plus/test";
import rule from "./no-deprecated-api.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "ts" } },
});

const ai = "import { generateText, streamText, generateObject, tool } from 'ai';";
const openai = "import OpenAI from 'openai'; const client = new OpenAI();";
const mcp =
  "import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'; const server = new McpServer({ name: 'x', version: '1' });";

tester.run("no-deprecated-api", rule, {
  valid: [
    `${ai} generateText({ model, instructions: 'x', maxOutputTokens: 100, stopWhen: stepCountIs(3) });`,
    `${ai} const r = streamText({ model, prompt: 'x' }); for await (const part of r.stream) {}`,
    `${ai} tool({ inputSchema: z.object({}), execute: async () => 1 });`,
    `${openai} client.chat.completions.create({ model: 'gpt-5', messages: [], tools: [], max_completion_tokens: 10 });`,
    `${mcp} server.registerTool('x', { inputSchema: {} }, async () => ({ content: [] }));`,
    // Same key names on something that is not the SDK.
    "import OpenAI from 'openai'; const other = { create(o) {} }; other.create({ functions: [] });",
    "import { generateText } from 'ai'; const mine = (o) => o; mine({ maxTokens: 1 });",
    // Below the major that deprecated it.
    {
      code: `${ai} generateText({ model, maxTokens: 100 });`,
      settings: { llm: { ai: 4 } },
    },
    {
      code: `${ai} generateObject({ model, schema });`,
      settings: { llm: { ai: 5 } },
    },
    {
      code: `${ai} generateText({ model, system: 'x' });`,
      settings: { llm: { ai: 6 } },
    },
    {
      code: `${openai} client.chat.completions.create({ model: 'gpt-4', messages: [], user: 'u' });`,
      settings: { llm: { openai: 5 } },
    },
    // Deprecated import of a different name.
    "import { ModelMessage } from 'ai'; const m: ModelMessage[] = [];",
  ],
  invalid: [
    {
      code: `${ai} generateText({ model, maxTokens: 100 });`,
      output: `${ai} generateText({ model, maxOutputTokens: 100 });`,
      errors: [
        {
          messageId: "deprecated",
          data: { detail: "maxTokens was renamed to maxOutputTokens in ai 5." },
        },
      ],
    },
    {
      code: `${ai} generateText({ model, 'maxTokens': 100 });`,
      output: `${ai} generateText({ model, 'maxOutputTokens': 100 });`,
      errors: [{ messageId: "deprecated" }],
    },
    {
      code: `${ai} const system = 'x'; streamText({ model, system });`,
      output: `${ai} const system = 'x'; streamText({ model, instructions: system });`,
      errors: [{ messageId: "deprecated" }],
    },
    {
      code: `${ai} streamText({ model, maxSteps: 5 });`,
      errors: [
        {
          messageId: "deprecated",
          data: { detail: "maxSteps was removed in ai 5. Use stopWhen: stepCountIs(n)." },
        },
      ],
    },
    {
      code: `${ai} tool({ parameters: z.object({}), execute: async () => 1 });`,
      output: `${ai} tool({ inputSchema: z.object({}), execute: async () => 1 });`,
      errors: [{ messageId: "deprecated" }],
    },
    {
      code: `${ai} generateObject({ model, schema });`,
      errors: [
        {
          messageId: "deprecated",
          data: {
            detail:
              "generateObject() is deprecated in ai 6. Use generateText() with an output setting.",
          },
        },
      ],
    },
    {
      code: "import * as ai from 'ai'; ai.streamObject({ model, schema });",
      errors: [{ messageId: "deprecated" }],
    },
    {
      code: `${ai} streamText({ model, onFinish() {}, onStepFinish: () => {}, experimental_telemetry: { isEnabled: true } });`,
      output: `${ai} streamText({ model, onEnd() {}, onStepEnd: () => {}, telemetry: { isEnabled: true } });`,
      errors: [
        { messageId: "deprecated" },
        { messageId: "deprecated" },
        { messageId: "deprecated" },
      ],
    },
    {
      code: `${ai} streamText({ model, includeRawChunks: true });`,
      errors: [{ messageId: "deprecated" }],
    },
    {
      code: `${ai} const r = streamText({ model }); for await (const p of r.fullStream) {}`,
      output: `${ai} const r = streamText({ model }); for await (const p of r.stream) {}`,
      errors: [
        {
          messageId: "deprecated",
          data: { detail: "result.fullStream was renamed to result.stream in ai 7." },
        },
      ],
    },
    {
      code: `${ai} for await (const p of streamText({ model }).fullStream) {}`,
      output: `${ai} for await (const p of streamText({ model }).stream) {}`,
      errors: [{ messageId: "deprecated" }],
    },
    {
      code: `${ai} export async function POST() { const result = streamText({ model }); return result.toUIMessageStreamResponse(); }`,
      errors: [{ messageId: "deprecated" }],
    },
    {
      code: `${ai} const result = streamText({ model }); return result.toDataStreamResponse();`,
      settings: { llm: { ai: 5 } },
      errors: [{ messageId: "deprecated" }],
    },
    {
      code: "import { CoreMessage, convertToCoreMessages } from 'ai';",
      errors: [{ messageId: "deprecated" }, { messageId: "deprecated" }],
    },
    {
      code: "import type { CoreMessage } from 'ai';",
      errors: [{ messageId: "deprecated" }],
    },
    // Version gating picks the right subset.
    {
      code: `${ai} generateText({ model, maxTokens: 1, system: 'x' });`,
      settings: { llm: { ai: 5 } },
      output: `${ai} generateText({ model, maxOutputTokens: 1, system: 'x' });`,
      errors: [{ messageId: "deprecated" }],
    },
    // openai
    {
      code: `${openai} client.chat.completions.create({ model: 'gpt-4', messages: [], functions: [], function_call: 'auto' });`,
      errors: [{ messageId: "deprecated" }, { messageId: "deprecated" }],
    },
    {
      code: `${openai} client.chat.completions.create({ model: 'gpt-5', messages: [], max_tokens: 100 });`,
      output: `${openai} client.chat.completions.create({ model: 'gpt-5', messages: [], max_completion_tokens: 100 });`,
      errors: [{ messageId: "deprecated" }],
    },
    {
      code: `${openai} client.responses.create({ model: 'gpt-5', input: 'x', user: 'u', prompt_cache_retention: '24h' });`,
      errors: [{ messageId: "deprecated" }, { messageId: "deprecated" }],
    },
    {
      code: `${openai} client.chat.completions.create({ model: 'gpt-5', messages: [], seed: 1 });`,
      errors: [{ messageId: "deprecated" }],
    },
    {
      // Loose match through a class field.
      code: "import OpenAI from 'openai'; class S { c = new OpenAI(); run() { return this.c.chat.completions.create({ model: 'x', messages: [], max_tokens: 1 }); } }",
      output:
        "import OpenAI from 'openai'; class S { c = new OpenAI(); run() { return this.c.chat.completions.create({ model: 'x', messages: [], max_completion_tokens: 1 }); } }",
      errors: [{ messageId: "deprecated" }],
    },
    // mcp
    {
      code: `${mcp} server.tool('add', { a: z.number() }, async ({ a }) => ({ content: [] }));`,
      errors: [{ messageId: "deprecated" }],
    },
    {
      code: `${mcp} server.prompt('p', async () => ({ messages: [] })); server.resource('r', 'file://x', async () => ({ contents: [] }));`,
      errors: [{ messageId: "deprecated" }, { messageId: "deprecated" }],
    },
  ],
});
