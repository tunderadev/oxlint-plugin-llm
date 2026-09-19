import { defineRule, type ESTree } from "@oxlint/plugins";
import { getProperty, hasSpread, memberName, unwrap, unwrapAwait } from "../shared/ast.ts";
import { SdkFile } from "../shared/imports.ts";
import { findVariable, singleDeclarator } from "../shared/scope.ts";
import { STREAMABLE_CREATE_CALLS } from "../shared/sdk.ts";
import { getStaticValue } from "../shared/static.ts";

/** Fields that only exist on a completed response, never on a stream. */
const RESPONSE_FIELDS = new Set([
  "choices",
  "output_text",
  "output",
  "content",
  "usage",
  "stop_reason",
  "finish_reason",
]);

export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Flag reads of a completed response on the result of a stream: true call.",
    },
    messages: {
      streamRead:
        "This call passes stream: true, so it returns a stream of events and .{{field}} is undefined. Iterate the result with for await, or drop stream: true.",
    },
    schema: [],
  },
  createOnce(context) {
    const file = new SdkFile(context);
    const streamingCalls = new Map<ESTree.CallExpression, boolean>();

    const isStreamingCreate = (call: ESTree.CallExpression): boolean => {
      let known = streamingCalls.get(call);
      if (known === undefined) {
        known = check(call);
        streamingCalls.set(call, known);
      }
      return known;
    };

    const check = (call: ESTree.CallExpression): boolean => {
      const [first] = call.arguments;
      const params = first && unwrap(first);
      if (params?.type !== "ObjectExpression" || hasSpread(params)) return false;
      const stream = getProperty(params, "stream");
      if (!stream) return false;
      if (getStaticValue(stream.value, context.sourceCode)?.value !== true) return false;
      return file.match(call.callee, STREAMABLE_CREATE_CALLS) !== null;
    };

    /** The `create()` call whose result `node` is, directly or through a const. */
    const producingCall = (node: ESTree.Node): ESTree.CallExpression | null => {
      const value = unwrapAwait(node);
      if (value.type === "CallExpression") return value;
      if (value.type !== "Identifier") return null;
      const variable = findVariable(context.sourceCode.getScope(value), value.name);
      const declarator = variable && singleDeclarator(variable);
      if (!declarator?.init) return null;
      const init = unwrapAwait(declarator.init);
      return init.type === "CallExpression" ? init : null;
    };

    return {
      before() {
        streamingCalls.clear();
        return file.reset() && (file.has("openai") || file.has("anthropic"));
      },
      MemberExpression(node) {
        const field = memberName(node);
        if (field === null || !RESPONSE_FIELDS.has(field)) return;
        const call = producingCall(node.object);
        if (!call || !isStreamingCreate(call)) return;
        context.report({ node, messageId: "streamRead", data: { field } });
      },
    };
  },
});
