import type { ApiRequest, ApiResponse } from "../../server/handlers.ts";
import { openRoom, replyJson } from "../../server/handlers.ts";

export default function handler(req: ApiRequest, res: ApiResponse): void {
  if (req.method !== "POST") {
    replyJson(res, 405, { error: "Use POST." });
    return;
  }
  openRoom(req, res);
}
