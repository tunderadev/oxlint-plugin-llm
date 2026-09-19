import { defineRule } from "@oxlint/plugins";
import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vite-plus/test";
import { getStaticValue } from "./static.ts";

RuleTester.describe = describe;
RuleTester.it = it;

// Reports the static value of every `probe(x)` argument, or "none".
const probe = defineRule({
  meta: { messages: { value: "{{json}}" } },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "Identifier" || node.callee.name !== "probe") return;
        const result = getStaticValue(node.arguments[0]!, context.sourceCode);
        context.report({
          node,
          messageId: "value",
          data: { json: result ? JSON.stringify(result) : "none" },
        });
      },
    };
  },
});

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "ts" } },
});

const is = (code: string, value: unknown) => ({
  code,
  errors: [{ message: JSON.stringify({ value }) }],
});
const unknown = (code: string) => ({ code, errors: [{ message: "none" }] });

tester.run("getStaticValue", probe, {
  valid: [],
  invalid: [
    is("probe(true)", true),
    is("probe('a')", "a"),
    is("probe(`a`)", "a"),
    is("probe(-1)", -1),
    is("probe(!0)", true),
    is("const x = true; probe(x)", true),
    is("const x = 'a'; const y = x; probe(y as string)", "a"),
    unknown("probe(`a${b}`)"),
    unknown("let x = true; probe(x)"),
    unknown("const x = f(); probe(x)"),
    unknown("function f(x) { probe(x) }"),
    unknown("probe(a + b)"),
  ],
});
