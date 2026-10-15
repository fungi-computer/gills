import { relativeTime } from "@fungi.computer/gills/presentation";
import assert from "node:assert/strict";
import * as Schema from "effect/Schema";
import {
  appDeclaredGillSchema,
  createGillClient,
  gillRequestSchema,
  rowPageSchemaV1,
} from "@fungi.computer/gills";

const declaration = Schema.decodeUnknownSync(appDeclaredGillSchema)({
  id: "inbox",
  title: "Inbox",
  source: "listInbox",
});
const rows = Schema.decodeUnknownSync(rowPageSchemaV1)([
  {
    id: "session-a",
    title: "Review",
    open: {
      params: [
        { key: "agent", value: "agent-a" },
        { key: "session", value: "session-a" },
      ],
    },
  },
]);
const request = Schema.decodeUnknownSync(gillRequestSchema)({
  viewId: "inbox",
});
const page = { viewId: "inbox", title: "Inbox", state: "full", rows };
const client = createGillClient({
  endpoint: "https://example.test/gills",
  declaration,
  fetch: (_url, init) => {
    assert.equal(init?.method, "PUT");
    assert.equal(init?.body, JSON.stringify(request));
    return Promise.resolve(globalThis.Response.json(page));
  },
});
assert.deepEqual(await client.request(request), page);

const choices = {
  options: [{ value: "main", label: "Main" }],
  next: "branch-next",
};
const picker = createGillClient({
  endpoint: "https://example.test/gills",
  declaration,
  fetch: () => Promise.resolve(globalThis.Response.json(choices)),
});
assert.deepEqual(
  await picker.request({
    viewId: declaration.id,
    options: "branch",
    params: { repository: "notes" },
  }),
  choices,
);

const filePath = `/${"界".repeat(4095)}`;
const fileRows = Schema.decodeUnknownSync(rowPageSchemaV1)([
  {
    id: "document-a",
    title: "Recent file",
    open: { params: [{ key: "path", value: filePath }] },
  },
]);
assert.equal(fileRows[0]?.open?.params[0]?.value, filePath);
assert.throws(() =>
  Schema.decodeUnknownSync(rowPageSchemaV1)([
    {
      id: "document-a",
      title: "Recent file",
      open: { params: [{ key: "path", value: `${filePath}x` }] },
    },
  ]),
);

assert.equal(relativeTime(520000, 1000000), "8m ago");
