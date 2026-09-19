import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vite-plus/test";
import rule from "./no-stream-result-as-response.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "ts" } },
});

const openai = "import OpenAI from 'openai'; const client = new OpenAI();";
const anthropic = "import Anthropic from '@anthropic-ai/sdk'; const client = new Anthropic();";

tester.run("no-stream-result-as-response", rule, {
  valid: [
    `${openai} const res = await client.chat.completions.create({ model: 'x', messages: [] }); res.choices[0];`,
    `${openai} const stream = await client.chat.completions.create({ model: 'x', messages: [], stream: true }); for await (const chunk of stream) { chunk.choices[0]; }`,
    `${openai} const stream = await client.responses.create({ model: 'x', input: 'x', stream: true }); for await (const event of stream) { event.type; }`,
    `${openai} const res = await client.chat.completions.create({ model: 'x', messages: [], stream: false }); res.choices;`,
    `${openai} const res = await client.chat.completions.create({ model: 'x', messages: [], stream: flag }); res.choices;`,
    `${openai} const res = await client.chat.completions.create({ ...params, stream: true }); res.choices;`,
    `${anthropic} const msg = await client.messages.create({ model: 'x', max_tokens: 1, messages: [] }); msg.content;`,
    `${anthropic} const stream = await client.messages.create({ model: 'x', max_tokens: 1, messages: [], stream: true }); for await (const e of stream) {}`,
    // Reassigned variable: cannot follow.
    `${openai} let res = await client.chat.completions.create({ model: 'x', messages: [], stream: true }); res = await other(); res.choices;`,
    // Not the SDK.
    "import OpenAI from 'openai'; const mine = { create: async (o) => o }; const r = await mine.create({ stream: true }); r.choices;",
  ],
  invalid: [
    {
      code: `${openai} const res = await client.chat.completions.create({ model: 'x', messages: [], stream: true }); console.log(res.choices[0].message);`,
      errors: [{ messageId: "streamRead", data: { field: "choices" } }],
    },
    {
      code: `${openai} const res = await client.responses.create({ model: 'x', input: 'x', stream: true }); return res.output_text;`,
      errors: [{ messageId: "streamRead", data: { field: "output_text" } }],
    },
    {
      code: `${openai} (await client.chat.completions.create({ model: 'x', messages: [], stream: true })).choices;`,
      errors: [{ messageId: "streamRead" }],
    },
    {
      code: `${openai} const STREAM = true; const res = await client.chat.completions.create({ model: 'x', messages: [], stream: STREAM }); res.usage;`,
      errors: [{ messageId: "streamRead" }],
    },
    {
      code: `${anthropic} const msg = await client.messages.create({ model: 'x', max_tokens: 1, messages: [], stream: true }); msg.content[0]; msg.stop_reason;`,
      errors: [{ messageId: "streamRead" }, { messageId: "streamRead" }],
    },
    {
      code: "import Anthropic from '@anthropic-ai/sdk'; class S { c = new Anthropic(); async run() { const m = await this.c.messages.create({ model: 'x', max_tokens: 1, messages: [], stream: true }); return m.content; } }",
      errors: [{ messageId: "streamRead" }],
    },
    {
      code: `${openai} async function run() { const res = await client.chat.completions.create({ model: 'x', messages: [], stream: true }); return res['choices']; }`,
      errors: [{ messageId: "streamRead" }],
    },
  ],
});
