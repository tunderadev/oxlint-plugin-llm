import { defineRule } from "@oxlint/plugins";
import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vite-plus/test";
import { unwrap } from "./ast.ts";
import { SdkFile } from "./imports.ts";

RuleTester.describe = describe;
RuleTester.it = it;

// A probe rule: every expression statement that is a call or member access
// is reported with its resolution, so each test asserts the resolver's output.
const probe = defineRule({
  meta: { messages: { resolved: "{{json}}" } },
  createOnce(context) {
    const file = new SdkFile(context);
    return {
      before: () => file.reset(),
      ExpressionStatement(node) {
        const expression = unwrap(node.expression);
        if (expression.type !== "CallExpression" && expression.type !== "MemberExpression") return;
        const target = expression.type === "CallExpression" ? expression.callee : expression;
        context.report({
          node,
          messageId: "resolved",
          data: { json: JSON.stringify(file.resolve(target)) },
        });
      },
    };
  },
});

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "ts" } },
});

const resolves = (code: string, expected: { sdk: string | null; path: string[] }) => ({
  code,
  errors: [{ message: JSON.stringify(expected) }],
});

tester.run("SdkFile.resolve", probe, {
  valid: [
    // No SDK import: before() returns false and nothing is visited.
    "import { x } from 'somewhere'; x();",
    "const a = 1; a.b;",
  ],
  invalid: [
    resolves("import { streamText } from 'ai'; streamText();", {
      sdk: "ai",
      path: ["streamText"],
    }),
    resolves("import { streamText as st } from 'ai'; st();", {
      sdk: "ai",
      path: ["streamText"],
    }),
    resolves("import * as ai from 'ai'; ai.streamText();", {
      sdk: "ai",
      path: ["streamText"],
    }),
    resolves("import { streamText } from 'ai'; streamText().fullStream;", {
      sdk: "ai",
      path: ["streamText", "()", "fullStream"],
    }),
    resolves("import { streamText } from 'ai'; const r = await streamText(); r.fullStream;", {
      sdk: "ai",
      path: ["streamText", "()", "fullStream"],
    }),
    resolves("import OpenAI from 'openai'; const c = new OpenAI(); c.chat.completions.create();", {
      sdk: "openai",
      path: ["OpenAI", "()", "chat", "completions", "create"],
    }),
    resolves("import { OpenAI } from 'openai'; new OpenAI().chat.completions.create();", {
      sdk: "openai",
      path: ["OpenAI", "()", "chat", "completions", "create"],
    }),
    resolves(
      "import { AzureOpenAI } from 'openai'; const c = new AzureOpenAI(); c.responses.create();",
      {
        sdk: "openai",
        path: ["OpenAI", "()", "responses", "create"],
      },
    ),
    resolves(
      "import * as openai from 'openai'; const c = new openai.OpenAI(); c.responses.create();",
      {
        sdk: "openai",
        path: ["OpenAI", "()", "responses", "create"],
      },
    ),
    resolves("const OpenAI = require('openai'); const c = new OpenAI(); c.responses.create();", {
      sdk: "openai",
      path: ["OpenAI", "()", "responses", "create"],
    }),
    resolves("const { streamText } = require('ai'); streamText();", {
      sdk: "ai",
      path: ["streamText"],
    }),
    resolves(
      "import Anthropic from '@anthropic-ai/sdk'; const client = new Anthropic({}); const { messages } = client; messages.create();",
      {
        sdk: "anthropic",
        path: ["Anthropic", "()", "messages", "create"],
      },
    ),
    resolves(
      "import Anthropic from '@anthropic-ai/sdk'; const client = new Anthropic(); const m = client.messages; m.create();",
      {
        sdk: "anthropic",
        path: ["Anthropic", "()", "messages", "create"],
      },
    ),
    resolves(
      "import Anthropic from '@anthropic-ai/sdk'; const client = new Anthropic(); (client as any)!.messages?.create();",
      {
        sdk: "anthropic",
        path: ["Anthropic", "()", "messages", "create"],
      },
    ),
    resolves(
      "import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'; const server = new McpServer({}); server.tool();",
      {
        sdk: "mcp",
        path: ["McpServer", "()", "tool"],
      },
    ),
    // Unresolvable roots keep the member chain so loose patterns can match the tail.
    resolves(
      "import OpenAI from 'openai'; class S { c: OpenAI; run() { this.c.chat.completions.create(); } }",
      {
        sdk: null,
        path: ["c", "chat", "completions", "create"],
      },
    ),
    resolves(
      "import OpenAI from 'openai'; function run(client: OpenAI) { client.chat.completions.create(); }",
      {
        sdk: null,
        path: ["chat", "completions", "create"],
      },
    ),
    resolves(
      "import OpenAI from 'openai'; function run() { const client = make(); client.chat.completions.create(); }",
      {
        sdk: null,
        path: ["chat", "completions", "create"],
      },
    ),
    // Known non-SDK roots are "other", never loose-matched.
    resolves(
      "import OpenAI from 'openai'; import Groq from 'groq-sdk'; const g = new Groq(); g.chat.completions.create();",
      {
        sdk: "other",
        path: [],
      },
    ),
    resolves(
      "import OpenAI from 'openai'; let c = new OpenAI(); c = other(); c.chat.completions.create();",
      {
        sdk: "other",
        path: [],
      },
    ),
    // Shadowing wins.
    resolves(
      "import { streamText } from 'ai'; function f() { const streamText = () => 1; streamText(); }",
      {
        sdk: "other",
        path: [],
      },
    ),
  ],
});
