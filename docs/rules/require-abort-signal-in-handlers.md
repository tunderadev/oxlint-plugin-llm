# llm/require-abort-signal-in-handlers

Flags a generation call inside a request handler that passes no abort signal.

When the browser closes the tab or the client times out, the handler's `Request` is aborted. The model does not know that unless the call gets the signal. It generates the whole response, you pay for every token, and on a streaming route the process holds the connection open until the model is done. The fix is one line: pass `req.signal`.

A function is a request handler when one of its parameters is named `req` or `request`, or is annotated with `Request`, `NextRequest`, or `IncomingMessage`. Calls in closures inside a handler count too, so a `generateText()` inside `items.map()` inside a `POST` is reported.

Where the signal goes:

| SDK                 | Call                                                                | Pass                                                          |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| `ai`                | `generateText`, `streamText`, `generateObject`, `streamObject`      | `abortSignal: req.signal` in the options, or `timeout`        |
| `openai`            | `chat.completions.create`, `responses.create`, `completions.create` | `{ signal: req.signal }` as the second argument, or `timeout` |
| `@anthropic-ai/sdk` | `messages.create`, `messages.stream`, and the `beta` versions       | `{ signal: req.signal }` as the second argument, or `timeout` |

If the options are a spread or a variable, the rule cannot see them and says nothing.

## Examples

Bad:

```ts
import { streamText } from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();
  return streamText({ model, messages });
}
```

Good:

```ts
export async function POST(req: Request) {
  const { messages } = await req.json();
  return streamText({ model, messages, abortSignal: req.signal });
}
```

## Options

```json
{
  "llm/require-abort-signal-in-handlers": [
    "error",
    { "handlerParams": ["req", "request", "c"], "handlerTypes": ["Request", "NextRequest"] }
  ]
}
```

- `handlerParams`: parameter names that mark a function as a handler. Default `["req", "request"]`.
- `handlerTypes`: type annotations that do the same. Default `["Request", "NextRequest", "IncomingMessage"]`.

Hono handlers take `c`, so add it to `handlerParams` there.

## Fixable

No.
