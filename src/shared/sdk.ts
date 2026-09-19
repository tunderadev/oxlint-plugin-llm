// The one data file. Which npm packages count as which SDK, how their
// default exports are named, and every deprecation the plugin knows about.
// Bumping an SDK major is an edit here, not in a rule.

export type SdkId = "ai" | "openai" | "anthropic" | "mcp";

export interface SdkInfo {
  id: SdkId;
  /** Name shown in messages. */
  label: string;
  /** npm packages, matched on the package name and any subpath under it. */
  packages: string[];
  /** Class the default export resolves to, so `import X from "openai"` and `import { OpenAI }` match the same path. */
  defaultExport?: string;
  /** Named exports that are the same client class under another name. */
  classAliases?: Record<string, string>;
}

export const SDKS: Record<SdkId, SdkInfo> = {
  ai: { id: "ai", label: "ai", packages: ["ai"] },
  openai: {
    id: "openai",
    label: "openai",
    packages: ["openai"],
    defaultExport: "OpenAI",
    classAliases: { AzureOpenAI: "OpenAI" },
  },
  anthropic: {
    id: "anthropic",
    label: "@anthropic-ai/sdk",
    packages: ["@anthropic-ai/sdk"],
    defaultExport: "Anthropic",
  },
  mcp: {
    id: "mcp",
    label: "@modelcontextprotocol/sdk",
    packages: ["@modelcontextprotocol/sdk", "@modelcontextprotocol/server"],
  },
};

export const SDK_IDS = Object.keys(SDKS) as SdkId[];

/** Map an import source like `@modelcontextprotocol/sdk/server/mcp.js` to an SDK id. */
export function sdkForSource(source: string): SdkId | null {
  for (const sdk of SDK_IDS) {
    for (const pkg of SDKS[sdk].packages) {
      if (source === pkg || source.startsWith(`${pkg}/`)) return sdk;
    }
  }
  return null;
}

/** Cheap pre-check on the raw text, so files that never import an SDK skip the AST walk. */
export const SDK_IMPORT_PATTERN = new RegExp(
  `["'](?:${SDK_IDS.flatMap((sdk) => SDKS[sdk].packages)
    .map((pkg) => pkg.replace(/[/@.]/g, "\\$&"))
    .join("|")})(?:/[^"']*)?["']`,
);

/** Major version of each SDK the linted project is on. */
export type Versions = Record<SdkId, number>;

/** Current majors on 2026-09-19. `anthropic` is still 0.x. */
export const CURRENT_MAJORS: Versions = { ai: 7, openai: 7, anthropic: 0, mcp: 2 };

// Call paths. `X()` means "an instance of X" (the result of `new X()` or of calling `X()`),
// so `OpenAI().chat.completions.create` is `client.chat.completions.create` on an OpenAI client.
// `loose` lets a rule match on the tail (`chat.completions.create`) when the receiver cannot be
// resolved, such as `this.client`, as long as the file imports that SDK.

export interface CallPattern {
  sdk: SdkId;
  path: string;
  loose?: boolean;
}

export const ANTHROPIC_MESSAGE_CALLS: CallPattern[] = [
  { sdk: "anthropic", path: "Anthropic().messages.create", loose: true },
  { sdk: "anthropic", path: "Anthropic().messages.stream", loose: true },
  { sdk: "anthropic", path: "Anthropic().beta.messages.create", loose: true },
  { sdk: "anthropic", path: "Anthropic().beta.messages.stream", loose: true },
];

export const OPENAI_CREATE_CALLS: CallPattern[] = [
  { sdk: "openai", path: "OpenAI().chat.completions.create", loose: true },
  { sdk: "openai", path: "OpenAI().responses.create", loose: true },
  { sdk: "openai", path: "OpenAI().completions.create", loose: true },
];

/** Calls that return a stream object which does nothing until something reads it. */
export const STREAM_CALLS: CallPattern[] = [
  { sdk: "ai", path: "streamText" },
  { sdk: "ai", path: "streamObject" },
  { sdk: "anthropic", path: "Anthropic().messages.stream", loose: true },
  { sdk: "anthropic", path: "Anthropic().beta.messages.stream", loose: true },
  // openai 4 and 5 had these helpers. 6 and 7 do not, but a file on 5 still needs the check.
  { sdk: "openai", path: "OpenAI().chat.completions.stream", loose: true },
  { sdk: "openai", path: "OpenAI().responses.stream", loose: true },
];

/** Calls that take `stream: true` in their params and then return a stream instead of a response. */
export const STREAMABLE_CREATE_CALLS: CallPattern[] = [
  ...OPENAI_CREATE_CALLS,
  { sdk: "anthropic", path: "Anthropic().messages.create", loose: true },
  { sdk: "anthropic", path: "Anthropic().beta.messages.create", loose: true },
];

/** Generation calls and where an abort signal goes for each. */
export interface GenerationCall extends CallPattern {
  /** `options`: a property of the first argument. `requestOptions`: a property of the second argument. */
  signal: "options" | "requestOptions";
}

export const GENERATION_CALLS: GenerationCall[] = [
  { sdk: "ai", path: "generateText", signal: "options" },
  { sdk: "ai", path: "streamText", signal: "options" },
  { sdk: "ai", path: "generateObject", signal: "options" },
  { sdk: "ai", path: "streamObject", signal: "options" },
  ...OPENAI_CREATE_CALLS.map((c) => ({ ...c, signal: "requestOptions" as const })),
  ...ANTHROPIC_MESSAGE_CALLS.map((c) => ({ ...c, signal: "requestOptions" as const })),
];

// Deprecations, checked against the installed SDK types on 2026-09-19.
// `since` is the major that deprecated or removed the name. An entry only fires when the
// configured major for that SDK is at or above `since`.

export type Deprecation =
  | {
      kind: "call";
      sdk: SdkId;
      path: string;
      loose?: boolean;
      since: number;
      message: string;
    }
  | {
      kind: "option";
      sdk: SdkId;
      /** Call paths whose first argument is the options object. */
      on: string[];
      loose?: boolean;
      name: string;
      since: number;
      message: string;
      /** Set when the fix is a pure rename of the key. */
      renameTo?: string;
    }
  | {
      kind: "member";
      sdk: SdkId;
      /** Path of the object the member is read from, such as `streamText()`. */
      on: string;
      name: string;
      since: number;
      message: string;
      renameTo?: string;
    }
  | {
      kind: "import";
      sdk: SdkId;
      name: string;
      since: number;
      message: string;
    };

const AI_TEXT_CALLS = ["generateText", "streamText"];
const AI_CALLS = [...AI_TEXT_CALLS, "generateObject", "streamObject"];
const AI_STREAM_RESULT_HELPERS =
  "Use the standalone toUIMessageStream() and createUIMessageStreamResponse() helpers from ai with result.stream.";

function aiRename(on: string[], name: string, renameTo: string, since: number): Deprecation {
  return {
    kind: "option",
    sdk: "ai",
    on,
    name,
    renameTo,
    since,
    message: `${name} was renamed to ${renameTo} in ai ${since}.`,
  };
}

function aiResultMethod(name: string, message: string): Deprecation {
  return {
    kind: "member",
    sdk: "ai",
    on: "streamText()",
    name,
    since: 7,
    message: `result.${name}() is deprecated in ai 7. ${message}`,
  };
}

export const DEPRECATIONS: Deprecation[] = [
  // ai 5 renamed the core option names. They are gone, not aliased, so these are runtime bugs.
  aiRename(AI_CALLS, "maxTokens", "maxOutputTokens", 5),
  {
    kind: "option",
    sdk: "ai",
    on: AI_TEXT_CALLS,
    name: "maxSteps",
    since: 5,
    message: "maxSteps was removed in ai 5. Use stopWhen: stepCountIs(n).",
  },
  aiRename(["tool", "dynamicTool"], "parameters", "inputSchema", 5),
  {
    kind: "import",
    sdk: "ai",
    name: "CoreMessage",
    since: 5,
    message: "CoreMessage was renamed to ModelMessage in ai 5.",
  },
  {
    kind: "import",
    sdk: "ai",
    name: "convertToCoreMessages",
    since: 5,
    message: "convertToCoreMessages was renamed to convertToModelMessages in ai 5.",
  },
  {
    kind: "member",
    sdk: "ai",
    on: "streamText()",
    name: "toDataStreamResponse",
    since: 5,
    message: `result.toDataStreamResponse() was renamed to toUIMessageStreamResponse() in ai 5. In ai 7, ${AI_STREAM_RESULT_HELPERS.charAt(0).toLowerCase()}${AI_STREAM_RESULT_HELPERS.slice(1)}`,
  },

  // ai 6 deprecated the object functions in favour of an output setting on the text functions.
  {
    kind: "call",
    sdk: "ai",
    path: "generateObject",
    since: 6,
    message: "generateObject() is deprecated in ai 6. Use generateText() with an output setting.",
  },
  {
    kind: "call",
    sdk: "ai",
    path: "streamObject",
    since: 6,
    message: "streamObject() is deprecated in ai 6. Use streamText() with an output setting.",
  },

  // ai 7 renamed a batch of options and result fields. All aliases still work, so these are warnings.
  aiRename(AI_CALLS, "system", "instructions", 7),
  aiRename(AI_TEXT_CALLS, "onFinish", "onEnd", 7),
  aiRename(AI_TEXT_CALLS, "onStepFinish", "onStepEnd", 7),
  aiRename(AI_TEXT_CALLS, "experimental_telemetry", "telemetry", 7),
  aiRename(AI_TEXT_CALLS, "experimental_repairToolCall", "repairToolCall", 7),
  aiRename(AI_TEXT_CALLS, "experimental_onStart", "onStart", 7),
  aiRename(AI_TEXT_CALLS, "experimental_onStepStart", "onStepStart", 7),
  aiRename(AI_TEXT_CALLS, "experimental_onLanguageModelCallStart", "onLanguageModelCallStart", 7),
  aiRename(AI_TEXT_CALLS, "experimental_onLanguageModelCallEnd", "onLanguageModelCallEnd", 7),
  aiRename(AI_TEXT_CALLS, "experimental_onToolCallStart", "onToolExecutionStart", 7),
  aiRename(AI_TEXT_CALLS, "experimental_onToolCallFinish", "onToolExecutionEnd", 7),
  aiRename(AI_TEXT_CALLS, "experimental_include", "include", 7),
  {
    kind: "option",
    sdk: "ai",
    on: ["streamText"],
    name: "includeRawChunks",
    since: 7,
    message: "includeRawChunks is deprecated in ai 7. Use include: { rawChunks: true }.",
  },
  {
    kind: "member",
    sdk: "ai",
    on: "streamText()",
    name: "fullStream",
    renameTo: "stream",
    since: 7,
    message: "result.fullStream was renamed to result.stream in ai 7.",
  },
  {
    kind: "member",
    sdk: "ai",
    on: "streamText()",
    name: "experimental_partialOutputStream",
    renameTo: "partialOutputStream",
    since: 7,
    message:
      "result.experimental_partialOutputStream was renamed to result.partialOutputStream in ai 7.",
  },
  aiResultMethod("toUIMessageStreamResponse", AI_STREAM_RESULT_HELPERS),
  aiResultMethod(
    "toUIMessageStream",
    "Use the standalone toUIMessageStream() helper from ai with result.stream.",
  ),
  aiResultMethod(
    "pipeUIMessageStreamToResponse",
    "Use the standalone toUIMessageStream() and pipeUIMessageStreamToResponse() helpers from ai with result.stream.",
  ),
  aiResultMethod(
    "toTextStreamResponse",
    "Use the standalone toTextStream() and createTextStreamResponse() helpers from ai with result.stream.",
  ),
  aiResultMethod(
    "pipeTextStreamToResponse",
    "Use the standalone toTextStream() and pipeTextStreamToResponse() helpers from ai with result.stream.",
  ),

  // openai chat completions.
  {
    kind: "option",
    sdk: "openai",
    on: ["OpenAI().chat.completions.create"],
    loose: true,
    name: "functions",
    since: 4,
    message: 'functions is deprecated in openai 4. Use tools with type: "function" entries.',
  },
  {
    kind: "option",
    sdk: "openai",
    on: ["OpenAI().chat.completions.create"],
    loose: true,
    name: "function_call",
    since: 4,
    message: "function_call is deprecated in openai 4. Use tool_choice.",
  },
  {
    kind: "option",
    sdk: "openai",
    on: ["OpenAI().chat.completions.create"],
    loose: true,
    name: "max_tokens",
    renameTo: "max_completion_tokens",
    since: 5,
    message:
      "max_tokens is deprecated for chat completions and rejected by reasoning models. Use max_completion_tokens.",
  },
  {
    kind: "option",
    sdk: "openai",
    on: ["OpenAI().chat.completions.create", "OpenAI().responses.create"],
    loose: true,
    name: "user",
    since: 6,
    message:
      "user is deprecated in openai 6. Use safety_identifier for abuse detection and prompt_cache_key for cache routing.",
  },
  {
    kind: "option",
    sdk: "openai",
    on: ["OpenAI().chat.completions.create"],
    loose: true,
    name: "seed",
    since: 7,
    message:
      "seed is deprecated in openai 7 and has no replacement. Determinism was never guaranteed.",
  },
  {
    kind: "option",
    sdk: "openai",
    on: ["OpenAI().chat.completions.create", "OpenAI().responses.create"],
    loose: true,
    name: "prompt_cache_retention",
    since: 7,
    message: "prompt_cache_retention is deprecated in openai 7. Use prompt_cache_options: { ttl }.",
  },

  // MCP TypeScript SDK. The short registration methods went away in v2.
  {
    kind: "call",
    sdk: "mcp",
    path: "McpServer().tool",
    since: 1,
    message:
      "server.tool() is deprecated and gone in @modelcontextprotocol/server 2. Use server.registerTool(name, config, handler).",
  },
  {
    kind: "call",
    sdk: "mcp",
    path: "McpServer().prompt",
    since: 1,
    message:
      "server.prompt() is deprecated and gone in @modelcontextprotocol/server 2. Use server.registerPrompt(name, config, handler).",
  },
  {
    kind: "call",
    sdk: "mcp",
    path: "McpServer().resource",
    since: 1,
    message:
      "server.resource() is deprecated and gone in @modelcontextprotocol/server 2. Use server.registerResource(name, uri, config, handler).",
  },
];
