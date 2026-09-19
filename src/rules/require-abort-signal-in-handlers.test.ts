import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vite-plus/test";
import rule from "./require-abort-signal-in-handlers.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "ts" } },
});

const ai = "import { generateText, streamText } from 'ai';";
const openai = "import OpenAI from 'openai'; const client = new OpenAI();";
const anthropic = "import Anthropic from '@anthropic-ai/sdk'; const client = new Anthropic();";

tester.run("require-abort-signal-in-handlers", rule, {
  valid: [
    `${ai} export async function POST(req: Request) { return streamText({ model, prompt: 'x', abortSignal: req.signal }); }`,
    `${ai} export async function POST(req: Request) { return streamText({ model, prompt: 'x', timeout: { totalMs: 30_000 } }); }`,
    `${openai} export async function POST(req: Request) { return client.chat.completions.create({ model: 'x', messages: [] }, { signal: req.signal }); }`,
    `${openai} export async function POST(req: Request) { return client.responses.create({ model: 'x', input: 'x' }, { timeout: 30_000 }); }`,
    `${anthropic} app.post('/chat', async (req, res) => { await client.messages.create({ model: 'x', max_tokens: 1, messages: [] }, { signal: req.signal }); });`,
    // Not inside a handler.
    `${ai} export async function summarise(text: string) { return generateText({ model, prompt: text }); }`,
    `${ai} const result = await generateText({ model, prompt: 'x' });`,
    `${openai} async function job() { return client.chat.completions.create({ model: 'x', messages: [] }); }`,
    // Cannot see the options, so no report.
    `${ai} export async function POST(req: Request) { return streamText({ ...base, prompt: 'x' }); }`,
    `${ai} export async function POST(req: Request) { return streamText(options); }`,
    `${openai} export async function POST(req: Request) { return client.chat.completions.create(params, requestOptions); }`,
    // Custom handler parameter names.
    {
      code: `${ai} app.get('/x', async (c) => generateText({ model, prompt: 'x', abortSignal: c.req.raw.signal }));`,
      options: [{ handlerParams: ["c"] }],
    },
    // Not the SDK.
    "import { generateText } from 'ai'; const mine = (o) => o; export async function POST(req: Request) { return mine({ prompt: 'x' }); }",
  ],
  invalid: [
    {
      code: `${ai} export async function POST(req: Request) { return streamText({ model, prompt: 'x' }); }`,
      errors: [{ messageId: "abortSignal", data: { call: "streamText()" } }],
    },
    {
      code: `${ai} export async function POST(request: Request) { const { messages } = await request.json(); return streamText({ model, messages }); }`,
      errors: [{ messageId: "abortSignal" }],
    },
    {
      code: `${ai} export const POST = async (req) => generateText({ model, prompt: 'x' });`,
      errors: [{ messageId: "abortSignal" }],
    },
    {
      code: `${ai} export async function POST(r: NextRequest) { return generateText({ model, prompt: 'x' }); }`,
      errors: [{ messageId: "abortSignal" }],
    },
    {
      // Nested closure inside a handler still counts.
      code: `${ai} export async function POST(req: Request) { const results = await Promise.all(items.map((item) => generateText({ model, prompt: item }))); return Response.json(results); }`,
      errors: [{ messageId: "abortSignal" }],
    },
    {
      code: `${openai} export async function POST(req: Request) { return client.chat.completions.create({ model: 'x', messages: [] }); }`,
      errors: [{ messageId: "signal", data: { call: "client.chat.completions.create()" } }],
    },
    {
      code: `${openai} export async function POST(req: Request) { return client.responses.create({ model: 'x', input: 'x' }, { headers: {} }); }`,
      errors: [{ messageId: "signal" }],
    },
    {
      code: `${anthropic} app.post('/chat', async (req, res) => { const stream = client.messages.stream({ model: 'x', max_tokens: 1, messages: [] }); stream.pipe(res); });`,
      errors: [{ messageId: "signal" }],
    },
    {
      code: "import Anthropic from '@anthropic-ai/sdk'; class Api { c = new Anthropic(); async handle(req: Request) { return this.c.messages.create({ model: 'x', max_tokens: 1, messages: [] }); } }",
      errors: [{ messageId: "signal" }],
    },
    {
      code: `${ai} app.get('/x', async (c) => generateText({ model, prompt: 'x' }));`,
      options: [{ handlerParams: ["c"] }],
      errors: [{ messageId: "abortSignal" }],
    },
  ],
});
