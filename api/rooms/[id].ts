import type { ApiRequest, ApiResponse } from "../../server/handlers.ts";
import { readRoom, replyJson } from "../../server/handlers.ts";

export default function handler(req: ApiRequest, res: ApiResponse): void {
  if (req.method !== "GET") {
    replyJson(res, 405, { error: "Use GET." });
    return;
  }
  readRoom(req, res);
}
