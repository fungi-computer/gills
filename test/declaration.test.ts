import * as Schema from "effect/Schema";
import { expect, it } from "vitest";
import { appDeclaredGillSchema } from "../src/index.js";

const inbox = { id: "inbox", title: "Inbox", source: "listInbox" };
const decode = Schema.decodeUnknownSync(appDeclaredGillSchema);
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
  expect(decode({ ...inbox, params: [param] }).params).toEqual([param]);
  expect(() =>
    decode({ ...inbox, params: [{ ...param, kind: "computer" }] }),
  ).toThrow();
});
