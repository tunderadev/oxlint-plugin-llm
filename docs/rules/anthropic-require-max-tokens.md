# llm/anthropic-require-max-tokens

Flags `messages.create()` and `messages.stream()` calls on an Anthropic client whose params object has no `max_tokens`.

The Messages API requires `max_tokens`. TypeScript catches the omission when the params are typed, but a params object built inline in JavaScript, or typed as `any`, gets through to a 400 at runtime. This rule catches it at lint time.

The rule only looks at object literals. A spread or a variable might carry the field, so those are left alone.

## Examples

Bad:

```ts
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();

await client.messages.create({
  model: "claude-sonnet-5",
  messages: [{ role: "user", content: "Hi" }],
});
```

Good:

```ts
await client.messages.create({
  model: "claude-sonnet-5",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hi" }],
});
```

Also checked: `client.beta.messages.create()`, `client.messages.stream()`, and `client.beta.messages.stream()`. The receiver can be anything the plugin can trace back to `new Anthropic()`, or a `messages.create` chain on an untraceable receiver such as `this.client` in a file that imports the SDK.

## Options

None.

## Fixable

No.
