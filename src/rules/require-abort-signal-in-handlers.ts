import { defineRule, type ESTree } from "@oxlint/plugins";
import { calleeLabel, enclosingFunctions, getProperty, hasSpread, unwrap } from "../shared/ast.ts";
import { SdkFile } from "../shared/imports.ts";
import { GENERATION_CALLS } from "../shared/sdk.ts";

type Options = {
  handlerParams: string[];
  handlerTypes: string[];
};

const DEFAULTS: Options = {
  handlerParams: ["req", "request"],
  handlerTypes: ["Request", "NextRequest", "IncomingMessage"],
};

export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Flag generation calls inside request handlers that pass no abort signal.",
    },
    messages: {
      abortSignal:
        "{{call}} runs inside a request handler without abortSignal. When the client disconnects the model keeps generating and you keep paying for it. Pass abortSignal: req.signal.",
      signal:
        "{{call}} runs inside a request handler without a signal. When the client disconnects the model keeps generating and you keep paying for it. Pass { signal: req.signal } as the second argument.",
    },
    schema: [
      {
        type: "object",
        properties: {
          handlerParams: { type: "array", items: { type: "string" } },
          handlerTypes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [DEFAULTS],
  },
  createOnce(context) {
    const file = new SdkFile(context);
    let options: Options = DEFAULTS;

    const isHandlerParam = (param: ESTree.ParamPattern): boolean => {
      let pattern: ESTree.Node = param;
      if (pattern.type === "TSParameterProperty") return false;
      if (pattern.type === "AssignmentPattern") pattern = pattern.left;
      if (pattern.type === "Identifier" && options.handlerParams.includes(pattern.name))
        return true;
      const annotation = "typeAnnotation" in pattern ? pattern.typeAnnotation : null;
      const type = annotation?.typeAnnotation;
      return (
        type?.type === "TSTypeReference" &&
        type.typeName.type === "Identifier" &&
        options.handlerTypes.includes(type.typeName.name)
      );
    };

    const insideHandler = (node: ESTree.Node): boolean => {
      for (const fn of enclosingFunctions(node)) {
        if (fn.params.some(isHandlerParam)) return true;
      }
      return false;
    };

    return {
      before() {
        options = { ...DEFAULTS, ...(context.options[0] as Partial<Options> | undefined) };
        return file.reset();
      },
      CallExpression(node) {
        if (!insideHandler(node)) return;
        const call = file.match(node.callee, GENERATION_CALLS);
        if (!call) return;
        const [first, second] = node.arguments;
        if (call.signal === "options") {
          const params = first && unwrap(first);
          if (params?.type !== "ObjectExpression" || hasSpread(params)) return;
          if (getProperty(params, "abortSignal") || getProperty(params, "timeout")) return;
        } else if (second) {
          const requestOptions = unwrap(second);
          if (requestOptions.type !== "ObjectExpression" || hasSpread(requestOptions)) return;
          if (getProperty(requestOptions, "signal") || getProperty(requestOptions, "timeout"))
            return;
        }
        context.report({
          node: node.callee,
          messageId: call.signal === "options" ? "abortSignal" : "signal",
          data: { call: calleeLabel(node.callee, context.sourceCode) },
        });
      },
    };
  },
});
