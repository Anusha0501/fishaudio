import type { ApiRequest, ApiResponse } from "../server/handlers.ts";
import { replyJson, sendRewrite } from "../server/handlers.ts";

export default function handler(req: ApiRequest, res: ApiResponse): void {
  if (req.method !== "POST") {
    replyJson(res, 405, { error: "Use POST." });
    return;
  }
  void sendRewrite(req, res);
}
