# llm/no-stream-result-as-response

Flags a `create()` call with `stream: true` whose result is then read like a finished response.

With `stream: true`, `client.chat.completions.create()`, `client.responses.create()`, and `client.messages.create()` resolve to an async iterable of events. There is no `.choices`, `.output_text`, or `.content` on it. Reading one of those fields is `undefined` at runtime and a crash one property later.

The rule follows the result through `await`, casts, and a `const` or `let` that is assigned once. `stream` has to be a literal `true` or a `const` that holds one.

Fields checked: `choices`, `output_text`, `output`, `content`, `usage`, `stop_reason`, `finish_reason`.

## Examples

Bad:

```ts
import OpenAI from "openai";
const client = new OpenAI();

const res = await client.chat.completions.create({ model, messages, stream: true });
console.log(res.choices[0].message.content);
```

Good:

```ts
const stream = await client.chat.completions.create({ model, messages, stream: true });
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta.content ?? "");
}
```

Or drop `stream: true` and keep reading `.choices`.

## Options

None.

## Fixable

No.
