import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vite-plus/test";
import rule from "./no-fixme.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "ts" } },
});

tester.run("no-fixme", rule, {
  valid: ["const a = 1;", "// TODO: later", "/* fixme in lowercase is not flagged */"],
  invalid: [
    {
      code: "// FIXME: handle empty input",
      errors: [{ messageId: "fixme", line: 1 }],
    },
    {
      code: "const a = 1; /* FIXME */",
      errors: [{ messageId: "fixme" }],
    },
  ],
});
