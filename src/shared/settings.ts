import type { Settings } from "@oxlint/plugins";
import { CURRENT_MAJORS, SDK_IDS, type Versions } from "./sdk.ts";

/**
 * Read `settings.llm` from the oxlint config and fill in the current majors.
 *
 * ```json
 * { "settings": { "llm": { "ai": 5, "openai": 6 } } }
 * ```
 *
 * Plugins cannot read package.json, so the majors have to come from config.
 */
export function readVersions(settings: Readonly<Settings> | undefined): Versions {
  const versions: Versions = { ...CURRENT_MAJORS };
  const llm = settings?.llm;
  if (typeof llm !== "object" || llm === null || Array.isArray(llm)) return versions;
  for (const sdk of SDK_IDS) {
    const value = (llm as Record<string, unknown>)[sdk];
    if (typeof value === "number" && Number.isFinite(value)) versions[sdk] = Math.floor(value);
  }
  return versions;
}
