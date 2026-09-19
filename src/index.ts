import { eslintCompatPlugin } from "@oxlint/plugins";
import anthropicRequireMaxTokens from "./rules/anthropic-require-max-tokens.ts";
import noDeprecatedApi from "./rules/no-deprecated-api.ts";
import noStreamResultAsResponse from "./rules/no-stream-result-as-response.ts";
import noUnconsumedStream from "./rules/no-unconsumed-stream.ts";
import requireAbortSignalInHandlers from "./rules/require-abort-signal-in-handlers.ts";

// The short name people write in rule ids, as in "llm/no-unconsumed-stream".
export const name = "llm";

export const rules = {
  // new-rule:start
  "anthropic-require-max-tokens": anthropicRequireMaxTokens,
  "no-deprecated-api": noDeprecatedApi,
  "no-unconsumed-stream": noUnconsumedStream,
  "no-stream-result-as-response": noStreamResultAsResponse,
  "require-abort-signal-in-handlers": requireAbortSignalInHandlers,
  // new-rule:end
};

const plugin = eslintCompatPlugin({
  meta: { name },
  rules,
});

export const configs = {
  recommended: {
    jsPlugins: ["oxlint-plugin-llm"],
    rules: {
      // new-rule:recommended:start
      [`${name}/anthropic-require-max-tokens`]: "error",
      [`${name}/no-deprecated-api`]: "warn",
      [`${name}/no-unconsumed-stream`]: "error",
      [`${name}/no-stream-result-as-response`]: "error",
      [`${name}/require-abort-signal-in-handlers`]: "error",
      // new-rule:recommended:end
    },
  },
};

export default plugin;
