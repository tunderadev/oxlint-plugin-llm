# llm/no-unconsumed-stream

Flags a streaming call whose result nothing reads.

`streamText()`, `streamObject()`, and `client.messages.stream()` return an object that does nothing until something iterates it, pipes it, or calls a helper on it. Drop the result and the request either never runs or runs with nobody listening, so the response body stays empty and finish callbacks never fire. The usual cause is a refactor that turned `return streamText(...)` into a statement.

Two shapes are reported:

- the call is a statement on its own, with or without `await`
- the call is assigned to a `const` or `let` that is never read

Anything else counts as consumed. Returning the result, passing it to a function, destructuring it, or exporting it all pass.

## Examples

Bad:

```ts
import { streamText } from "ai";

export async function POST(req: Request) {
  streamText({ model, prompt: "Hi" });
  return new Response("ok");
}

const result = streamText({ model, prompt: "Hi" });
```

Good:

```ts
export async function POST(req: Request) {
  const result = streamText({ model, prompt: "Hi", abortSignal: req.signal });
  return createUIMessageStreamResponse({ stream: toUIMessageStream(result.stream) });
}

const result = streamText({ model, prompt: "Hi" });
for await (const part of result.stream) {
}
```

## Options

None.

## Fixable

No.
