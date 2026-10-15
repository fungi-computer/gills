import * as Schema from "effect/Schema";
import {
  appDeclaredGillSchema,
  createGillClient,
  decodeGillOptionsResponse,
  gillRequestSchema,
  rowPageSchemaV1,
  type AppDeclaredGill,
  type AppGillDesktopSize,
  type GillRequest,
  type GillReply,
  type GillOptionsResponse,
  type GillCall,
  type RowV1,
} from "@fungi.computer/gills";

const size: AppGillDesktopSize = "M";
const declaration: AppDeclaredGill = Schema.decodeUnknownSync(
  appDeclaredGillSchema,
)({
  id: "inbox",
  title: "Inbox",
  source: "listInbox",
  desktop: { sizes: [size] },
});
const rows: readonly RowV1[] = Schema.decodeUnknownSync(rowPageSchemaV1)([]);
const request: GillRequest = Schema.decodeUnknownSync(gillRequestSchema)({
  viewId: declaration.id,
});
const response: Promise<GillReply> = createGillClient({
  declaration,
  endpoint: "https://example.test/gills",
  fetch: () =>
    Promise.resolve(
      Response.json({
        viewId: declaration.id,
        title: declaration.title,
        state: "empty",
        rows,
      }),
    ),
}).request(request);
void response;

const choices: GillOptionsResponse = decodeGillOptionsResponse({
  options: [{ value: "main", label: "Main" }],
  next: "next",
});
const call: GillCall = {
  id: declaration.id,
  options: "branch",
  params: { repository: "notes" },
};
void choices;
void call;
