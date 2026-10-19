import type { ApiRequest, ApiResponse } from "../server/handlers.ts";
import { sendSpeech } from "../server/handlers.ts";

export default function handler(req: ApiRequest, res: ApiResponse): void {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }
  void sendSpeech(req, res);
}
