import { defineRule } from "@oxlint/plugins";

// A small rule that shows the shape of a rule in this repo: `createOnce`
// runs once per rule, `before` runs per file and can skip it, and comments
// come from `sourceCode.getAllComments()`. Keep it or delete it.
export default defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Flag FIXME comments so they do not ship.",
    },
    messages: {
      fixme: "FIXME comment found. Fix it or turn it into a tracked issue.",
    },
    schema: [],
  },
  createOnce(context) {
    return {
      before() {
        // Skip files with no comments at all. Cheap, and JS plugins have no cache.
        return context.sourceCode.getAllComments().length > 0;
      },
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (/\bFIXME\b/.test(comment.value)) {
            context.report({ loc: comment.loc, messageId: "fixme" });
          }
        }
      },
    };
  },
});
