import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vite-plus/test";
import rule from "./anthropic-require-max-tokens.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "ts" } },
});

const setup = "import Anthropic from '@anthropic-ai/sdk'; const client = new Anthropic();";

tester.run("anthropic-require-max-tokens", rule, {
  valid: [
    `${setup} client.messages.create({ model: 'claude-sonnet-5', max_tokens: 1024, messages: [] });`,
    `${setup} client.messages.stream({ model: 'claude-sonnet-5', max_tokens: 1024, messages: [] });`,
    `${setup} client.beta.messages.create({ model: 'claude-sonnet-5', max_tokens: 1024, messages: [] });`,
    `${setup} client.messages.create({ 'max_tokens': 1024, messages: [] });`,
    // Cannot see inside a spread or a variable, so no report.
    `${setup} client.messages.create({ ...base, messages: [] });`,
    `${setup} client.messages.create(params);`,
    // Other calls on the client do not take max_tokens.
    `${setup} client.messages.countTokens({ model: 'claude-sonnet-5', messages: [] });`,
    `${setup} client.messages.batches.create({ requests: [] });`,
    // Not the Anthropic client.
    "const client = { messages: { create() {} } }; client.messages.create({ messages: [] });",
    "import OpenAI from 'openai'; const client = new OpenAI(); client.chat.completions.create({ messages: [] });",
    // Same-shaped call in a file that imports the SDK but on a receiver that resolves to something else.
    `${setup} import Other from 'other-sdk'; const o = new Other(); o.messages.create({ messages: [] });`,
  ],
  invalid: [
    {
      code: `${setup} client.messages.create({ model: 'claude-sonnet-5', messages: [] });`,
      errors: [{ messageId: "missing", line: 1 }],
    },
    {
      code: `${setup} await client.messages.stream({ model: 'claude-sonnet-5', messages: [] });`,
      errors: [{ messageId: "missing" }],
    },
    {
      code: `${setup} client.beta.messages.create({ model: 'claude-sonnet-5', messages: [] });`,
      errors: [{ messageId: "missing" }],
    },
    {
      code: `${setup} client.beta.messages.stream({ model: 'claude-sonnet-5', messages: [] });`,
      errors: [{ messageId: "missing" }],
    },
    {
      code: "import { Anthropic } from '@anthropic-ai/sdk'; new Anthropic().messages.create({ messages: [] });",
      errors: [{ messageId: "missing" }],
    },
    {
      code: "const Anthropic = require('@anthropic-ai/sdk'); const c = new Anthropic(); c.messages.create({ messages: [] });",
      errors: [{ messageId: "missing" }],
    },
    {
      // Loose match: the receiver is a class field, but the file imports the SDK.
      code: "import Anthropic from '@anthropic-ai/sdk'; class S { client = new Anthropic(); run() { return this.client.messages.create({ messages: [] }); } }",
      errors: [{ messageId: "missing" }],
    },
    {
      code: "import Anthropic from '@anthropic-ai/sdk'; export function run(client: Anthropic) { return client.messages.create({ model: 'x', messages: [] }); }",
      errors: [{ messageId: "missing" }],
    },
  ],
});
