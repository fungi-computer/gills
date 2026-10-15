import * as Schema from "effect/Schema";
import { appGillParamKeySchema, type AppDeclaredGill } from "./declaration.js";
import {
  rowLabelSchemaV1 as label,
  rowIdentitySchemaV1 as identity,
  rowPageSchemaV1 as rows,
} from "./rows.js";

/** Placement values are bounded; the admitting host checks declared keys. */
export const gillParamsSchema = Schema.Record(
  appGillParamKeySchema,
  Schema.String.check(Schema.isMaxLength(256)),
).check(
  Schema.makeFilter((params) => Object.keys(params).length <= 4, {
    message: "Gill placement supports at most four parameters",
  }),
);
/** The caller supplies placement context and a source-owned continuation. */
export const gillRequestSchema = Schema.Struct({
  viewId: identity,
  params: Schema.optional(gillParamsSchema),
  after: Schema.optional(Schema.String.check(Schema.isMaxLength(1_024))),
  options: Schema.optional(appGillParamKeySchema),
});
/** Selectors supplied by a Gill caller. */
export type GillRequest = Schema.Schema.Type<typeof gillRequestSchema>;

/** Runtime call selected by the host after admitting a declared source. */
export const gillCallSchema = Schema.Struct({
  id: identity,
  params: Schema.optional(gillParamsSchema),
  after: Schema.optional(Schema.String.check(Schema.isMaxLength(1_024))),
  options: Schema.optional(appGillParamKeySchema),
});
/** Input to the generated backend Gill entry. */
export type GillCall = Schema.Schema.Type<typeof gillCallSchema>;

/** Shared response codec. Rows are plain text and cannot carry executable UI. */
export const gillResponseSchema = Schema.Union([
  Schema.Struct({
    viewId: identity,
    title: label,
    state: Schema.Literal("empty"),
    rows: Schema.Tuple([]),
    next: Schema.optional(
      Schema.String.pipe(Schema.check(Schema.isMaxLength(1_024))),
    ),
  }),
  Schema.Struct({
    viewId: identity,
    title: label,
    state: Schema.Literal("error"),
    rows: Schema.Tuple([]),
    /** Host-owned permanent execution refusal; an ordinary error may still be refreshed. */
    reason: Schema.optional(
      Schema.Literals(["exec_isolation_required", "params_required"]),
    ),
    error: Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.check(Schema.isMaxLength(512)),
    ),
    /** The host supplies the same-placement picker and this App's launch. */
    recovery: Schema.optional(
      Schema.Union([
        Schema.Struct({
          kind: Schema.Literal("configure"),
          param: appGillParamKeySchema,
        }),
        Schema.Struct({ kind: Schema.Literal("open") }),
      ]),
    ),
  }),
  Schema.Struct({
    viewId: identity,
    title: label,
    state: Schema.Literal("full"),
    rows: rows.pipe(Schema.check(Schema.isMinLength(1))),
    next: Schema.optional(
      Schema.String.pipe(Schema.check(Schema.isMaxLength(1_024))),
    ),
  }),
]);
/** A decoded page of plain-text Gill rows or a bounded error. */
export type GillResponse = Schema.Schema.Type<typeof gillResponseSchema>;

/** Decode backend output once at the App host boundary. */
export const decodeGillResponse = Schema.decodeUnknownSync(gillResponseSchema, {
  onExcessProperty: "error",
});

/** A bounded choice page returned by an App-owned options read method. */
export const gillOptionsResponseSchema = Schema.Struct({
  options: Schema.Array(
    Schema.Struct({
      value: Schema.String.check(Schema.isMaxLength(256)),
      label,
      detail: Schema.optional(Schema.String.check(Schema.isMaxLength(1_024))),
    }),
  ).check(Schema.isMaxLength(200)),
  next: Schema.optional(Schema.String.check(Schema.isMaxLength(1_024))),
});
/** Choices remain within the selected App; the host supplies Computer choices. */
export type GillOptionsResponse = Schema.Schema.Type<
  typeof gillOptionsResponseSchema
>;
/** Shared wire for a rows read or a placement-options read. */
export const gillReplySchema = Schema.Union([
  gillResponseSchema,
  gillOptionsResponseSchema,
]);
/** A rows read or a placement-options read. */
export type GillReply = Schema.Schema.Type<typeof gillReplySchema>;
/** Decode the selected host's bounded reply before rendering or navigation. */
export const decodeGillReply = Schema.decodeUnknownSync(gillReplySchema, {
  onExcessProperty: "error",
});
/** Decode an options method's result without trusting extra fields. */
export const decodeGillOptionsResponse = Schema.decodeUnknownSync(
  gillOptionsResponseSchema,
  { onExcessProperty: "error" },
);

/** App output must match its digest-covered view identity. */
export function decodeDeclaredGillResponse(
  response: GillResponse,
  declaration: Pick<AppDeclaredGill, "id" | "params">,
): GillResponse {
  if (response.viewId !== declaration.id)
    throw new Error("Gill response does not match its Release declaration");
  const recovery = response.state === "error" ? response.recovery : undefined;
  if (
    recovery?.kind === "configure" &&
    !declaration.params?.some((param) => param.key === recovery.param)
  )
    throw new Error("Gill recovery parameter is not declared");
  return response;
}

/** Authenticated host Fetch stays outside App code and is pinned to one selection. */
export function createGillClient(
  options: Readonly<{
    /** Decode a host's HTTP 503 body into its Gill refusal, if recognized. */
    decodeRefusal?: (
      raw: Schema.Json,
      declaration: Readonly<{ id: string; title: string }>,
    ) => GillResponse | undefined;
    endpoint: string;
    fetch: typeof globalThis.fetch;
    declaration: Pick<AppDeclaredGill, "id" | "title" | "params">;
  }>,
) {
  return {
    /** Fetch one decoded page using this client's pinned declaration. */
    async request(
      selectors: GillRequest,
      signal?: AbortSignal,
    ): Promise<GillReply> {
      if (selectors.viewId !== options.declaration.id)
        throw new Error("Gill request does not match its Release declaration");
      const response = await options.fetch(options.endpoint, {
        method: "PUT",
        redirect: "error",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Schema.encodeSync(gillRequestSchema)(selectors)),
        signal: signal ?? null,
      });
      if (!response.ok) {
        if (response.status === 503) {
          let raw: Schema.Json;
          try {
            raw = Schema.decodeUnknownSync(Schema.Json)(await response.json());
          } catch (cause) {
            throw new Error("Gill request refused with HTTP 503", { cause });
          }
          const refusal = options.decodeRefusal?.(raw, options.declaration);
          if (refusal !== undefined) return refusal;
        } else {
          await response.body?.cancel();
        }
        throw new Error(
          `Gill request refused with HTTP ${String(response.status)}`,
        );
      }
      const raw: unknown = await response.json();
      const reply = decodeGillReply(raw);
      if ("options" in reply) {
        if (selectors.options === undefined)
          throw new Error("Gill returned choices for a row read");
        return reply;
      }
      if (selectors.options !== undefined && reply.state !== "error")
        throw new Error("Gill returned rows for an options read");
      return decodeDeclaredGillResponse(reply, options.declaration);
    },
  };
}
