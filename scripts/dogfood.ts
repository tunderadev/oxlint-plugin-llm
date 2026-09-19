// Prove the built plugin loads in real oxlint, not just in RuleTester.
// Runs oxlint over fixtures/ with the plugin from dist/ and expects every configured rule to fire.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

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
  diagnostics?: { code?: string; message: string; filename: string }[];
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
    "oxlint reported nothing for fixtures/. The plugin did not load or no rule fired.\n" +
      result.stderr,
  );
  process.exit(1);
}

// oxlint reports plugin rules as "plugin(rule)". Every rule in the fixture config must show up.
const config = JSON.parse(readFileSync("fixtures/oxlintrc.json", "utf8")) as {
  rules?: Record<string, unknown>;
};
const fired = new Set(diagnostics.map((d) => d.code));
const silent = Object.keys(config.rules ?? {}).filter((rule) => {
  const [plugin, name] = rule.split("/");
  return !fired.has(`${plugin}(${name})`);
});
if (silent.length > 0) {
  console.error(
    `These rules are enabled in fixtures/oxlintrc.json but reported nothing:\n  ${silent.join("\n  ")}\nAdd a fixture that trips each one.`,
  );
  process.exit(1);
}
console.log(`ok: ${diagnostics.length} diagnostic(s) from the built plugin, every rule fired.`);
