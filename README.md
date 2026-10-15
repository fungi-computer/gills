# Gills (`@fungi.computer/gills`)

Gills defines compact, plain-text App views shared by browser and terminal
hosts. It owns the row wire format, Gill declarations, bounded requests and
responses, and an authenticated-fetch client. Your host owns admission,
navigation and read-method admission.

## Install or set up

```sh
npm install @fungi.computer/gills effect@4.0.2
```

Gills is ESM. Effect is its only runtime dependency. All exports are available
from `@fungi.computer/gills` in Node, browsers and Workers.

## Quick start

Decode a row page and the selectors a caller may send:

```ts
import * as Schema from "effect/Schema";
import { rowPageSchemaV1, gillRequestSchema } from "@fungi.computer/gills";

const rows = Schema.decodeUnknownSync(rowPageSchemaV1)([
  { id: "session-a", title: "Review the draft", tone: "attention" },
]);
const request = Schema.decodeUnknownSync(gillRequestSchema, {
  onExcessProperty: "error",
})({ viewId: "inbox" });
console.log(rows[0]?.title, request.viewId);
```

## Core concepts

- A **declaration** records the Gill's App-local identity, source read method,
  optional placement parameters and their options read methods, change feed and
  desktop sizes. Agar generates it from the backend; Puffball includes it in the
  Release digest.
- A **request** contains a view ID, placement parameters and optional source
  cursor. The host admits the method and Computer before invoking the App.
- A **response** is an empty page, a full page of text rows, or an error. A
  request with `options: <parameter key>` returns a choice page instead.
  `decodeDeclaredGillResponse` rejects another view's identity.
- A **row** carries display text and optional navigation parameters. The host
  opens the Gill's own App; that App interprets the parameters. Rows cannot name
  a different App, a URL, or a Session-specific target. Navigation values retain
  up to 4,096 characters, including a Computer file path; display shortening
  never changes navigation values.
- Optional `row.status` carries the App's plain label and semantic tone for a
  compact status indicator. The App maps its state; the host does not infer it.
- An error can offer `recovery: { kind: "configure", param: "computer" }` or
  `recovery: { kind: "open" }`. Configure must name a declared parameter and
  opens that placement's existing picker. Open uses the host's launcher for the
  same App. Neither form contains an App ID, URL or command. App names and icons
  remain host directory presentation, outside this wire.

## API reference

See the [generated API](docs/api/index.md) for the schemas, inferred types and
`createGillClient`.

## Examples

`createGillClient({ endpoint, fetch, declaration })` sends bounded selectors
with PUT and decodes the result. Supply an authenticated `fetch` pinned to the
selected App and Release. An optional `decodeRefusal(raw, declaration)` handles
recognized HTTP 503 bodies using the host's own decoder. Unrecognized refusals
throw; the client does not choose host policy.

Agar's App execution refusal decoder remains in `@fungi.computer/agar/gills`.
App producers and renderers import the shared contract directly from this
package.

## Limits and errors

Pages contain at most 200 rows. Row labels allow 4,096 characters, identities
513 and details 1,024. A navigation intent has at most 16 parameters, with
64-character keys and 4,096-character values. Requests bound cursors to 1,024
characters and placement context to four keys with 256-character values.
Declarations offer up to four unique parameters of kind Computer, repository or
branch, and unique desktop sizes from S, M and L. An optional watch names an
existing storage marker or binding change feed. Resource envelopes and row
actions are not part of the contract.

Decoders reject invalid wire values. Gill output is text data, never executable
UI. Loading is host state. The client throws on HTTP errors unless the injected
host decoder recognizes the refusal.

## Contribute and license

Run `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm docs` and
`pnpm stranger` in this package. Regenerate API docs with `pnpm docs:write`.
Licensed under [MIT](LICENSE).

### Shared row time copy

`relativeTime` from `@fungi.computer/gills/presentation` formats a reported
millisecond timestamp using the Apps' existing English relative-time copy. This
pure entry does not load the Gill decoder. Source methods keep their timestamps
unchanged; a projection only formats timestamps its source returns.
