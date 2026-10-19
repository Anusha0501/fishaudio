import type { IncomingMessage, ServerResponse } from "node:http";
import { getCharacter } from "../src/engine/characters.ts";
import { usdPerMillionBytes } from "../src/engine/credits.ts";
import { translate } from "../src/engine/translate.ts";
import { fishKey, fishModel } from "./env.ts";
import { acceptMessage, createRoom, getRoom, messagesAfter } from "./rooms.ts";
import { FishError, synthesize } from "./tts.ts";

const recentSpeaks = new Map<string, number[]>();
const ROOM_ID = /^[a-z0-9-]{6,40}$/;

export type ApiRequest = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

export type ApiResponse = ServerResponse & {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  send: (body: Buffer | string) => void;
};

export function clientIp(req: ApiRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = raw?.split(",")[0]?.trim();
  return first || req.socket?.remoteAddress || "local";
}

export function readBody(req: ApiRequest): unknown {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as unknown;
    } catch {
      return null;
    }
  }
  return req.body ?? null;
}

function queryValue(req: ApiRequest, name: string): string {
  const value = req.query?.[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function tooManySpeaks(ip: string): boolean {
  const now = Date.now();
  const window = (recentSpeaks.get(ip) ?? []).filter((stamp) => now - stamp < 60_000);
  if (window.length >= 20) {
    recentSpeaks.set(ip, window);
    return true;
  }
  window.push(now);
  recentSpeaks.set(ip, window);
  return false;
}

export function sendHealth(_req: ApiRequest, res: ApiResponse): void {
  const model = fishModel();
  res.status(200).json({
    configured: Boolean(fishKey()),
    model,
    pricePerMillionBytes: usdPerMillionBytes(model),
  });
}

export async function sendSpeech(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (tooManySpeaks(clientIp(req))) {
    res.status(429).json({ error: "The booth is catching its breath. Try again in a minute." });
    return;
  }

  const body = readBody(req) as { text?: unknown; characterId?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text : "";
  const characterId = typeof body?.characterId === "string" ? body.characterId : "";
  const character = getCharacter(characterId);
  if (!character) {
    res.status(400).json({ error: "Pick a character first." });
    return;
  }

  const line = translate(text, character.id);
  if (!line.performance) {
    res.status(400).json({ error: "That line was empty." });
    return;
  }

  const apiKey = fishKey();
  if (!apiKey) {
    res.status(503).json({
      error: "Add FISH_API_KEY to .env to speak with Fish Audio.",
      code: "unconfigured",
    });
    return;
  }

  const model = fishModel();
  try {
    const spoken = await synthesize(line.performance, character, model, apiKey);
    res.status(200);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Booth-Cached", spoken.cached ? "hit" : "miss");
    res.setHeader("X-Booth-Model", model);
    res.setHeader("X-Booth-Bytes", String(spoken.bytes));
    res.setHeader("X-Booth-Usd", spoken.usd.toFixed(6));
    res.send(spoken.audio);
  } catch (error) {
    const status = error instanceof FishError ? error.status : 502;
    const message = error instanceof Error ? error.message : "Fish Audio did not answer.";
    const safeStatus = status === 401 || status === 402 || status === 429 ? status : 502;
    res.status(safeStatus).json({ error: message });
  }
}

export function openRoom(_req: ApiRequest, res: ApiResponse): void {
  const room = createRoom();
  res.status(201).json({ id: room.id });
}

export function readRoom(req: ApiRequest, res: ApiResponse): void {
  const id = queryValue(req, "id");
  if (!ROOM_ID.test(id)) {
    res.status(400).json({ error: "That room name is not one of ours." });
    return;
  }
  const room = getRoom(id);
  if (!room) {
    res.status(404).json({ error: "That booth has closed." });
    return;
  }
  res.status(200).json({ id: room.id, messages: messagesAfter(room, queryValue(req, "after")) });
}

export function postRoomMessage(req: ApiRequest, res: ApiResponse): void {
  const id = queryValue(req, "id");
  if (!ROOM_ID.test(id)) {
    res.status(400).json({ error: "That room name is not one of ours." });
    return;
  }
  if (!getRoom(id)) {
    res.status(404).json({ error: "That booth has closed." });
    return;
  }
  const message = acceptMessage(id, readBody(req));
  if (!message) {
    res.status(400).json({ error: "That line could not be taken." });
    return;
  }
  res.status(201).json(message);
}
