import { eslintCompatPlugin } from "@oxlint/plugins";
import noFixme from "./rules/no-fixme.ts";

// The short name people write in rule ids, as in "template/no-fixme".
// Change it in init-template, or by hand if you skipped the script.
export const name = "template";

export const rules = {
  // new-rule:start
  "no-fixme": noFixme,
  // new-rule:end
};

const plugin = eslintCompatPlugin({
  meta: { name },
  rules,
});

export const configs = {
  recommended: {
    jsPlugins: ["oxlint-plugin-template"],
    rules: {
      // new-rule:recommended:start
      [`${name}/no-fixme`]: "warn",
      // new-rule:recommended:end
    },
  },
};

export default plugin;
