import type { ApiRequest, ApiResponse } from "../../../server/handlers.ts";
import { postRoomMessage } from "../../../server/handlers.ts";

export default function handler(req: ApiRequest, res: ApiResponse): void {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }
  postRoomMessage(req, res);
}
