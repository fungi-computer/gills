import * as Schema from "effect/Schema";

/** Sizes the App explicitly offers for a desktop Gill. */
export type AppGillDesktopSize = "S" | "M" | "L";

/** One App-owned placement selector. */
export type AppGillParam = Readonly<{
  key: string;
  label: string;
  kind: "computer" | "repository" | "branch";
  required: boolean;
  /** This App's declared read method returning picker choices; Computers are host-owned. */
  options?: string | undefined;
}>;
/** An existing change feed used to refresh a Gill. */
export type AppGillWatch = Readonly<{ storage: string } | { binding: string }>;
/** A digest-covered projection of one declared read method. */
export type AppDeclaredGill = Readonly<{
  id: string;
  source: string;
  title: string;
  params?: readonly AppGillParam[] | undefined;
  watch?: AppGillWatch | undefined;
  desktop?: Readonly<{ sizes: readonly AppGillDesktopSize[] }> | undefined;
}>;

const isUnique = (values: readonly string[]): boolean =>
  new Set(values).size === values.length;
const meaningful = Schema.String.pipe(
  Schema.check(Schema.isMaxLength(256)),
  Schema.check(
    Schema.makeFilter((value) => value.trim().length > 0, {
      message: "Declared command text must not be blank",
    }),
  ),
);
/** Bounded, App-owned parameter key. */
export const appGillParamKeySchema = meaningful.pipe(
  Schema.check(Schema.isMaxLength(64)),
);
/** Placement parameter metadata, included in the Release digest. */
export const appGillParamSchema = Schema.Struct({
  key: appGillParamKeySchema,
  label: meaningful,
  kind: Schema.Literals(["computer", "repository", "branch"]),
  required: Schema.Boolean,
  options: Schema.optional(meaningful),
}).check(
  Schema.makeFilter(
    (param) => param.kind !== "computer" || param.options === undefined,
    {
      message: "Computer options are host-owned",
    },
  ),
);
/** The bounded, uniquely keyed placement parameters shared with desktop catalogs. */
export const appGillParamsSchema = Schema.Array(appGillParamSchema).check(
  Schema.isMaxLength(4),
  Schema.makeFilter((params) => isUnique(params.map((param) => param.key)), {
    message: "Gill parameter keys must be unique",
  }),
);
/** A storage marker or host binding's existing change feed. */
export const appGillWatchSchema = Schema.Union([
  Schema.Struct({ storage: meaningful }),
  Schema.Struct({ binding: meaningful }),
]);

/** Digest-covered identity, source, context and desktop sizes of a Gill. */
export const appDeclaredGillSchema: Schema.Codec<AppDeclaredGill> =
  Schema.Struct({
    id: meaningful.pipe(
      Schema.check(
        Schema.makeFilter((id) => !id.includes(":"), {
          message: "Gill IDs are App-local",
        }),
      ),
    ),
    title: meaningful,
    source: meaningful,
    params: Schema.optional(appGillParamsSchema),
    watch: Schema.optional(appGillWatchSchema),
    desktop: Schema.optional(
      Schema.Struct({
        sizes: Schema.Array(Schema.Literals(["S", "M", "L"])).check(
          Schema.isMinLength(1),
          Schema.isMaxLength(3),
          Schema.makeFilter(isUnique, {
            message: "Desktop Gill sizes must be unique",
          }),
        ),
      }),
    ),
  });
