// Prove the built plugin loads in real oxlint, not just in RuleTester.
// Runs oxlint over fixtures/ with the plugin from dist/ and expects at least one diagnostic.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

if (!existsSync("dist/index.mjs")) {
  console.error("dist/index.mjs is missing. Run `pnpm build` first.");
  process.exit(1);
}

const result = spawnSync(
  "pnpm",
  ["exec", "oxlint", "--config", "fixtures/oxlintrc.json", "--format", "json", "fixtures"],
  { encoding: "utf8" },
);

const parsed = JSON.parse(result.stdout || "{}") as {
  diagnostics?: { message: string; filename: string }[];
};
const diagnostics = parsed.diagnostics ?? [];
const pluginErrors = diagnostics.filter((d) => d.message.startsWith("Error running JS plugin"));

if (pluginErrors.length > 0) {
  console.error(
    "The plugin crashed inside oxlint:\n" + pluginErrors.map((d) => d.message).join("\n"),
  );
  process.exit(1);
}
if (diagnostics.length === 0) {
  console.error(
    "oxlint reported nothing for fixtures/. The plugin did not load or the rule did not fire.\n" +
      result.stderr,
  );
  process.exit(1);
}
console.log(`ok: ${diagnostics.length} diagnostic(s) from the built plugin.`);
