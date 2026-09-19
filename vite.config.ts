import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: { generator: "tsgo" },
    exports: true,
  },
  lint: {
    ignorePatterns: ["dist/**", "fixtures/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
  staged: {
    "*.{ts,json,md}": "vp check --fix",
  },
});
