import * as Schema from "effect/Schema";
import { rowPageSchemaV1, gillRequestSchema } from "@fungi.computer/gills";

const rows = Schema.decodeUnknownSync(rowPageSchemaV1)([
  { id: "session-a", title: "Review the draft", tone: "attention" },
]);
const request = Schema.decodeUnknownSync(gillRequestSchema, {
  onExcessProperty: "error",
})({ viewId: "inbox" });
console.log(rows[0]?.title, request.viewId);
