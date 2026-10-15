import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import {
  decodeDeclaredGillResponse,
  decodeGillResponse,
  gillRequestSchema,
  gillReplySchema,
  type AppDeclaredGill,
} from "../src/index.js";

const page = {
  viewId: "commits",
  title: "Recent Commits",
  state: "full",
  rows: [
    {
      id: "sha-a",
      title: "A real commit",
      open: { params: [{ key: "commit", value: "sha-a" }] },
    },
  ],
};
const decodeRequest = Schema.decodeUnknownSync(gillRequestSchema, {
  onExcessProperty: "error",
});
describe("source-backed Gill wire", () => {
  it("restricts recovery to the App launch or a declared placement parameter", () => {
    const failure = {
      viewId: "files",
      title: "Recent Files",
      state: "error",
      rows: [],
      error: "Choose a Computer",
    };
    const open = { ...failure, recovery: { kind: "open" } };
    expect(decodeGillResponse(open)).toEqual(open);
    const configure = decodeGillResponse({
      ...failure,
      recovery: { kind: "configure", param: "computer" },
    });
    const declaration: AppDeclaredGill = {
      id: "files",
      title: "Recent Files",
      source: "documents.recent",
      params: [
        {
          key: "computer",
          label: "Computer",
          kind: "computer",
          required: true,
        },
      ],
    };
    expect(decodeDeclaredGillResponse(configure, declaration)).toBe(configure);
    expect(() =>
      decodeDeclaredGillResponse(configure, { ...declaration, params: [] }),
    ).toThrow();
    for (const recovery of [
      { kind: "open", appId: "other" },
      { kind: "open", url: "https://other.test" },
      { kind: "configure", param: "x".repeat(65) },
      { kind: "configure", param: "computer", command: "execute" },
      { kind: "execute" },
    ])
      expect(() => decodeGillResponse({ ...failure, recovery })).toThrow();
  });
  it("preserves the App's plain status label and semantic tone", () => {
    const status = { label: "Needs approval", tone: "warning" };
    expect(
      decodeGillResponse({
        ...page,
        rows: [{ id: "change-1", title: "Open Change", status }],
      }).rows[0],
    ).toEqual({ id: "change-1", title: "Open Change", status });
    for (const invalid of [
      { label: "", tone: "warning" },
      { label: "x".repeat(4097), tone: "warning" },
      { label: "Needs approval", tone: "needs-approval" },
      { ...status, html: "<strong>Needs approval</strong>" },
    ])
      expect(() =>
        decodeGillResponse({
          ...page,
          rows: [{ id: "change-1", title: "Open Change", status: invalid }],
        }),
      ).toThrow();
  });
  it("sends placement context and an opaque source cursor without host resource data", () => {
    const request = {
      viewId: "commits",
      params: { repository: "notes", branch: "main" },
      after: "cursor",
    };
    expect(decodeRequest(request)).toEqual(request);
    expect(decodeRequest({ viewId: "commits", options: "repository" })).toEqual(
      { viewId: "commits", options: "repository" },
    );
    for (const extra of [
      { hostResource: { resource: "agent.sessions.inbox", data: {} } },
      { action: { id: "visit" } },
      { releaseId: "untrusted" },
    ])
      expect(() => decodeRequest({ viewId: "commits", ...extra })).toThrow();
  });
  it("bounds placement values to 256 characters and four keys", () => {
    expect(
      decodeRequest({
        viewId: "commits",
        params: { repository: "x".repeat(256) },
      }),
    ).toBeDefined();
    for (const params of [
      { repository: "x".repeat(257) },
      { a: "1", b: "2", c: "3", d: "4", e: "5" },
      { ["k".repeat(65)]: "value" },
    ])
      expect(() => decodeRequest({ viewId: "commits", params })).toThrow();
    expect(() =>
      decodeRequest({ viewId: "commits", after: "x".repeat(1025) }),
    ).toThrow();
  });
  it("opens a bounded intent within its App without a URL, App ID, or Session-specific target", () => {
    expect(decodeGillResponse(page).rows[0]?.open).toEqual(page.rows[0]?.open);
    const open = (count: number) => ({
      params: Array.from({ length: count }, (_, index) => ({
        key: `key${String(index)}`,
        value: "value",
      })),
    });
    expect(
      decodeGillResponse({
        ...page,
        rows: [{ id: "a", title: "A", open: open(16) }],
      }).rows[0]?.open?.params,
    ).toHaveLength(16);
    const path = `/${"界".repeat(4095)}`;
    const file = decodeGillResponse({
      ...page,
      rows: [
        {
          id: "document-a",
          title: "File",
          open: { params: [{ key: "path", value: path }] },
        },
      ],
    });
    expect(file.rows[0]?.open?.params).toEqual([{ key: "path", value: path }]);
    for (const target of [
      open(17),
      { params: [{ key: "x".repeat(65), value: "v" }] },
      { params: [{ key: "file", value: "x".repeat(4097) }] },
      { kind: "session", agentId: "a", sessionId: "s" },
      { params: [], appId: "other" },
      { params: [], url: "https://other.test" },
    ])
      expect(() =>
        decodeGillResponse({
          ...page,
          rows: [{ id: "a", title: "A", open: target }],
        }),
      ).toThrow();
    expect(() =>
      decodeGillResponse({
        ...page,
        rows: [
          { id: "a", title: "A", actions: [{ id: "visit", label: "Open" }] },
        ],
      }),
    ).toThrow();
  });
  it("keeps row identity, text and page bounds and rejects executable content", () => {
    expect(
      decodeGillResponse({
        ...page,
        rows: [{ id: "a", title: "x".repeat(4096) }],
      }),
    ).toBeDefined();
    for (const rows of [
      [],
      [{ id: "a", title: "x".repeat(4097) }],
      [{ id: "a", title: "A", html: "<script>run()</script>" }],
      Array.from({ length: 201 }, (_, i) => ({ id: String(i), title: "A" })),
    ])
      expect(() => decodeGillResponse({ ...page, rows })).toThrow();
    expect(
      decodeGillResponse({
        viewId: "commits",
        title: "Commits",
        state: "empty",
        rows: [],
      }).state,
    ).toBe("empty");
    expect(() =>
      decodeGillResponse({
        viewId: "commits",
        title: "Commits",
        state: "loading",
        rows: [],
      }),
    ).toThrow();
    expect(() =>
      decodeGillResponse({
        viewId: "commits",
        title: "Commits",
        state: "error",
        rows: [],
      }),
    ).toThrow();
  });
  it("keeps host refusal reasons distinct and response identity pinned", () => {
    const response = decodeGillResponse(page);
    expect(decodeDeclaredGillResponse(response, { id: "commits" })).toBe(
      response,
    );
    expect(() =>
      decodeDeclaredGillResponse(response, { id: "other" }),
    ).toThrow();
    expect(
      decodeGillResponse({
        viewId: "commits",
        title: "Commits",
        state: "error",
        rows: [],
        reason: "params_required",
        error: "Choose a repository",
      }).state,
    ).toBe("error");
  });
});

it("bounds option values, labels, details and page size without accepting navigation payloads", () => {
  const decode = Schema.decodeUnknownSync(gillReplySchema, {
    onExcessProperty: "error",
  });
  const option = {
    value: "v".repeat(256),
    label: "L".repeat(4096),
    detail: "d".repeat(1024),
  };
  expect(decode({ options: [option], next: "next" })).toEqual({
    options: [option],
    next: "next",
  });
  for (const options of [
    [{ ...option, value: "v".repeat(257) }],
    [{ ...option, label: "L".repeat(4097) }],
    [{ ...option, detail: "d".repeat(1025) }],
    [{ ...option, appId: "other" }],
    Array.from({ length: 201 }, () => option),
  ])
    expect(() => decode({ options })).toThrow();
});
