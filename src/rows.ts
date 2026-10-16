import * as Schema from "effect/Schema";

/** Nonempty display text, bounded to 4,096 characters. */
export const rowLabelSchemaV1 = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.check(Schema.isMaxLength(4_096)),
);
/** Producer-owned row identity, bounded to 513 characters. */
export const rowIdentitySchemaV1 = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.check(Schema.isMaxLength(513)),
);

/** A navigation parameter interpreted only by the receiving App. */
export const rowOpenSchemaV1 = Schema.Struct({
  params: Schema.Array(
    Schema.Struct({
      key: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(64)),
      value: Schema.String.check(Schema.isMaxLength(4_096)),
    }),
  ).check(Schema.isMaxLength(16)),
});

/** A bounded text row; each receiving host authorizes its open target. */
export const rowSchemaV1 = Schema.Struct({
  id: rowIdentitySchemaV1,
  title: rowLabelSchemaV1,
  detail: Schema.optional(
    Schema.String.pipe(Schema.check(Schema.isMaxLength(1_024))),
  ),
  tone: Schema.optional(
    Schema.Literals(["attention", "running", "error", "settled", "muted"]),
  ),
  /** App-owned status text with the semantic colors used by Caps Status. */
  status: Schema.optional(
    Schema.Struct({
      label: rowLabelSchemaV1,
      tone: Schema.Literals([
        "neutral",
        "primary",
        "secondary",
        "accent",
        "success",
        "info",
        "warning",
        "error",
      ]),
    }),
  ),
  /** The host supplies this Gill's App identity; rows only select its view. */
  open: Schema.optional(rowOpenSchemaV1),
});
/** One shared, bounded data row; the host owns navigation and execution. */
export type RowV1 = Schema.Schema.Type<typeof rowSchemaV1>;

/** A page containing at most 200 shared rows. */
export const rowPageSchemaV1 = Schema.Array(rowSchemaV1).pipe(
  Schema.check(Schema.isMaxLength(200)),
);

/** A finished App call as a person reads it: a shared row plus an optional thumbnail. */
export const resultRowSchemaV1 = Schema.Struct({
  ...rowSchemaV1.fields,
  /** A Computer file the receiving host may preview; the host authorizes the read. */
  media: Schema.optional(
    Schema.Struct({
      path: rowLabelSchemaV1,
      format: Schema.Literals(["fungi:image", "fungi:video"]),
    }),
  ),
});
/** One shared result row; navigation and previews stay host-authorized. */
export type ResultRow = Schema.Schema.Type<typeof resultRowSchemaV1>;
