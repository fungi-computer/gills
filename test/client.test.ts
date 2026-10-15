import { expect, it } from "vitest";
import * as Schema from "effect/Schema";
import { createGillClient, decodeGillResponse } from "../src/index.js";

it("leaves HTTP refusal policy with the injected host decoder", async () => {
  const declaration = { id: "inbox", title: "Inbox" };
  const page = decodeGillResponse({
    viewId: "inbox",
    title: "Inbox",
    state: "error",
    rows: [],
    error: "Host refused",
  });
  const options = {
    endpoint: "https://example.test/gills",
    declaration,
    fetch: () =>
      Promise.resolve(Response.json({ refused: true }, { status: 503 })),
  };
  await expect(
    createGillClient(options).request({ viewId: "inbox" }),
  ).rejects.toThrow("HTTP 503");
  const client = createGillClient({
    ...options,
    decodeRefusal: (raw, selected) => {
      expect(raw).toEqual({ refused: true });
      expect(selected).toEqual(declaration);
      return page;
    },
  });
  expect(await client.request({ viewId: "inbox" })).toEqual(page);
});

it("sends the selected context and preserves App-local row navigation and the source cursor", async () => {
  const request = {
    viewId: "changes",
    params: { repository: "notes" },
    after: "source-before",
  };
  const response = {
    viewId: "changes",
    title: "Changes",
    state: "full",
    rows: [
      {
        id: "1",
        title: "Review",
        open: { params: [{ key: "change", value: "1" }] },
      },
    ],
    next: "source-after",
  };
  const client = createGillClient({
    declaration: { id: "changes", title: "Changes" },
    endpoint: "https://example.test/gills",
    fetch: (_url, init) => {
      expect(init?.method).toBe("PUT");
      expect(init?.body).toBe(JSON.stringify(request));
      return Promise.resolve(Response.json(response));
    },
  });
  expect(await client.request(request)).toEqual(response);
});

it("decodes an App-owned picker page and retains its continuation", async () => {
  const response = {
    options: [{ value: "main", label: "Main", detail: "Default branch" }],
    next: "next-branch",
  };
  const client = createGillClient({
    declaration: { id: "commits", title: "Commits" },
    endpoint: "https://example.test/gills",
    fetch: (_url, init) => {
      const body = Schema.decodeUnknownSync(Schema.String)(init?.body);
      expect(Schema.decodeUnknownSync(Schema.Json)(JSON.parse(body))).toEqual({
        viewId: "commits",
        options: "branch",
        params: { repository: "notes" },
      });
      return Promise.resolve(Response.json(response));
    },
  });
  expect(
    await client.request({
      viewId: "commits",
      options: "branch",
      params: { repository: "notes" },
    }),
  ).toEqual(response);
});
