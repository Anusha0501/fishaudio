import type { ApiRequest, ApiResponse } from "../server/handlers.ts";
import { sendHealth } from "../server/handlers.ts";

export default function handler(req: ApiRequest, res: ApiResponse): void {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Use GET." });
    return;
  }
  sendHealth(req, res);
}
