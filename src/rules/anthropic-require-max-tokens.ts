import { defineRule } from "@oxlint/plugins";
import { getProperty, hasSpread, unwrap } from "../shared/ast.ts";
import { SdkFile } from "../shared/imports.ts";
import { ANTHROPIC_MESSAGE_CALLS } from "../shared/sdk.ts";

export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Flag messages.create() calls without max_tokens.",
    },
    messages: {
      missing:
        "max_tokens is missing. The Messages API rejects the request without it, so this call fails at runtime.",
    },
    schema: [],
  },
  createOnce(context) {
    const file = new SdkFile(context);
    return {
      before: () => file.reset() && file.has("anthropic"),
      CallExpression(node) {
        const [params] = node.arguments;
        if (!params) return;
        const object = unwrap(params);
        // A spread or a variable may carry max_tokens. Only an object literal can be checked.
        if (object.type !== "ObjectExpression" || hasSpread(object)) return;
        if (getProperty(object, "max_tokens")) return;
        if (!file.match(node.callee, ANTHROPIC_MESSAGE_CALLS)) return;
        context.report({ node: object, messageId: "missing" });
      },
    };
  },
});
