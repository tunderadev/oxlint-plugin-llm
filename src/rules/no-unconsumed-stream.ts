import { defineRule, type ESTree } from "@oxlint/plugins";
import { calleeLabel, outerParent } from "../shared/ast.ts";
import { SdkFile } from "../shared/imports.ts";
import { STREAM_CALLS } from "../shared/sdk.ts";

export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Flag streaming calls whose result is never read.",
    },
    messages: {
      unconsumed:
        "The stream from {{call}} is never read. Nothing is sent until something iterates it, so the response stays empty and finish callbacks never run. Iterate it, return a response built from it, or call consumeStream().",
    },
    schema: [],
  },
  createOnce(context) {
    const file = new SdkFile(context);
    return {
      before: () => file.reset(),
      CallExpression(node) {
        const user = outerParent(node);
        if (user.type === "ExpressionStatement") {
          if (!file.match(node.callee, STREAM_CALLS)) return;
          report(node);
          return;
        }
        // outerParent stepped through await and casts, so if the declarator is the user,
        // the call is the whole initializer and not something nested inside it.
        if (user.type !== "VariableDeclarator" || user.id.type !== "Identifier") return;
        if (isExported(user)) return;
        const [variable] = context.sourceCode.getDeclaredVariables(user);
        if (!variable || variable.references.some((reference) => reference.isRead())) return;
        if (!file.match(node.callee, STREAM_CALLS)) return;
        report(node);
      },
    };

    function report(node: ESTree.CallExpression) {
      context.report({
        node,
        messageId: "unconsumed",
        data: { call: calleeLabel(node.callee, context.sourceCode) },
      });
    }
  },
});

function isExported(declarator: ESTree.VariableDeclarator): boolean {
  const declaration = declarator.parent as ESTree.Node;
  return (declaration.parent as ESTree.Node | null)?.type === "ExportNamedDeclaration";
}
