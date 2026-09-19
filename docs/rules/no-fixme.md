# template/no-fixme

Flags comments that contain the word FIXME.

A FIXME is a promise to come back. This rule makes sure the promise is kept before the code ships, or moved into an issue where someone will see it.

## Examples

Bad:

```ts
// FIXME: handle empty input
function parse(input: string) {}
```

Good:

```ts
// See #42 for the empty-input case.
function parse(input: string) {}
```

## Options

None.

## Fixable

No.
