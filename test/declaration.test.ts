import * as Schema from "effect/Schema";
import { expect, it } from "vitest";
import { appDeclaredGillSchema } from "../src/index.js";
import { appStoredGillSchema } from "../src/index.js";

const inbox = {
  id: "inbox",
  title: "Inbox",
  view: "rows",
  source: "listInbox",
};
const decode = Schema.decodeUnknownSync(appDeclaredGillSchema);
it("admits a surface without a read source and requires an explicit view", () => {
  const strict = Schema.decodeUnknownSync(appDeclaredGillSchema, {
    onExcessProperty: "error",
  });
  const surface = {
    id: "canvas",
    title: "Canvas",
    view: "surface",
    desktop: { sizes: ["M", "L"] },
  };
  expect(strict(surface)).toEqual(surface);
  expect(strict({ ...inbox, view: "rows" })).toEqual({
    ...inbox,
    view: "rows",
  });
  expect(() =>
    strict({ id: "inbox", title: "Inbox", source: "listInbox" }),
  ).toThrow();
  expect(() => strict({ ...surface, source: "listInbox" })).toThrow();
  expect(() => strict({ ...surface, desktop: undefined })).toThrow();
});
it("decodes a stored Gill that predates views as rows, while declarations still require one", () => {
  const stored = Schema.decodeUnknownSync(appStoredGillSchema, {
    onExcessProperty: "error",
  });
  const old = { id: "inbox", title: "Inbox", source: "listInbox" };
  expect(stored(old)).toEqual(inbox);
  expect(stored(inbox)).toEqual(inbox);
  expect(Schema.encodeSync(appStoredGillSchema)(stored(old))).toEqual(inbox);
  expect(() => stored({ ...old, view: "grid" })).toThrow();
  expect(() => stored({ ...old, extra: true })).toThrow();
  // Only storage names the default: authoring is a clean break.
  expect(() => decode(old)).toThrow();
});
it("retains the desktop sizes in the canonical digest-covered Gill declaration", () => {
  expect(decode({ ...inbox, desktop: { sizes: ["S", "M", "L"] } })).toEqual({
    ...inbox,
    desktop: { sizes: ["S", "M", "L"] },
  });
  expect(decode(inbox)).toEqual(inbox);
});
it.each([["XL"], [], ["M", "M"], ["S", "M", "L", "S"]])(
  "rejects undeclared or ambiguous desktop sizes %s",
  (...sizes) => {
    expect(() => decode({ ...inbox, desktop: { sizes } })).toThrow();
  },
);

it("declares bounded placement parameters and a storage change marker", () => {
  const value = {
    view: "rows",
    id: "recent-commits",
    title: "Recent Commits",
    source: "history.recent",
    params: [
      {
        key: "repository",
        label: "Repository",
        kind: "repository",
        required: true,
      },
    ],
    watch: { storage: "repo-changed" },
  };
  expect(decode(value)).toEqual(value);
});

it("rejects duplicate or oversized placement declarations and obsolete resource/actions", () => {
  const strict = Schema.decodeUnknownSync(appDeclaredGillSchema, {
    onExcessProperty: "error",
  });
  const param = {
    key: "repository",
    label: "Repository",
    kind: "repository",
    required: true,
  };
  for (const params of [
    [param, param],
    [{ ...param, kind: "url" }],
    [{ ...param, key: "k".repeat(65) }],
    Array.from({ length: 5 }, (_, i) => ({ ...param, key: String(i) })),
  ])
    expect(() => strict({ ...inbox, params })).toThrow();
  for (const extra of [
    { resource: "agent.sessions.inbox" },
    { actions: [{ id: "visit", title: "Open" }] },
  ])
    expect(() => strict({ ...inbox, ...extra })).toThrow();
});

it("declares an App-owned options read method while keeping Computer choices host-owned", () => {
  const param = {
    key: "repository",
    label: "Repository",
    kind: "repository",
    required: true,
    options: "repos.options",
  };
  expect(decode({ ...inbox, params: [param] })).toMatchObject({
    params: [param],
  });
  expect(() =>
    decode({ ...inbox, params: [{ ...param, kind: "computer" }] }),
  ).toThrow();
});
