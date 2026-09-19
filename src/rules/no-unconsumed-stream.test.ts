import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vite-plus/test";
import rule from "./no-unconsumed-stream.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "ts" } },
});

const ai = "import { streamText, streamObject } from 'ai';";
const anthropic = "import Anthropic from '@anthropic-ai/sdk'; const client = new Anthropic();";

tester.run("no-unconsumed-stream", rule, {
  valid: [
    `${ai} const result = streamText({ model }); for await (const part of result.stream) {}`,
    `${ai} const result = streamText({ model }); return result.toUIMessageStreamResponse();`,
    `${ai} const result = streamText({ model }); result.consumeStream();`,
    `${ai} export function run() { return streamText({ model }); }`,
    `${ai} const run = () => streamText({ model });`,
    `${ai} export const result = streamText({ model });`,
    `${ai} const { textStream } = streamText({ model }); for await (const t of textStream) {}`,
    `${ai} const results = [streamText({ model })];`,
    `${ai} void streamText({ model });`,
    `${anthropic} const stream = client.messages.stream({ model: 'x', max_tokens: 1, messages: [] }); for await (const e of stream) {}`,
    `${anthropic} const stream = client.messages.stream({ model: 'x', max_tokens: 1, messages: [] }); const message = await stream.finalMessage();`,
    // Not a stream call.
    "import { generateText } from 'ai'; generateText({ model });",
    `${anthropic} client.messages.create({ model: 'x', max_tokens: 1, messages: [] });`,
    // Same names on something else.
    "import { streamText } from 'ai'; const mine = { streamText() {} }; mine.streamText();",
  ],
  invalid: [
    {
      code: `${ai} streamText({ model, prompt: 'x' });`,
      errors: [{ messageId: "unconsumed", data: { call: "streamText()" } }],
    },
    {
      code: `${ai} await streamText({ model, prompt: 'x' });`,
      errors: [{ messageId: "unconsumed" }],
    },
    {
      code: `${ai} export async function POST() { streamObject({ model, schema }); return new Response('ok'); }`,
      errors: [{ messageId: "unconsumed" }],
    },
    {
      code: `${ai} const result = streamText({ model });`,
      errors: [{ messageId: "unconsumed" }],
    },
    {
      code: `${ai} async function run() { const result = await streamText({ model }); console.log('started'); }`,
      errors: [{ messageId: "unconsumed" }],
    },
    {
      code: `${ai} const result = streamText({ model }) as any;`,
      errors: [{ messageId: "unconsumed" }],
    },
    {
      code: "import * as ai from 'ai'; ai.streamText({ model });",
      errors: [{ messageId: "unconsumed" }],
    },
    {
      code: `${anthropic} client.messages.stream({ model: 'x', max_tokens: 1, messages: [] });`,
      errors: [{ messageId: "unconsumed" }],
    },
    {
      code: `${anthropic} const stream = client.beta.messages.stream({ model: 'x', max_tokens: 1, messages: [] });`,
      errors: [{ messageId: "unconsumed" }],
    },
    {
      code: "import Anthropic from '@anthropic-ai/sdk'; class S { c = new Anthropic(); run() { this.c.messages.stream({ model: 'x', max_tokens: 1, messages: [] }); } }",
      errors: [{ messageId: "unconsumed" }],
    },
    {
      code: "import OpenAI from 'openai'; const client = new OpenAI(); client.chat.completions.stream({ model: 'x', messages: [] });",
      errors: [{ messageId: "unconsumed" }],
    },
  ],
});
