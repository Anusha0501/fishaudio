import type { IncomingMessage, ServerResponse } from "node:http";
import { getCharacter } from "../src/engine/characters.ts";
import { usdPerMillionBytes } from "../src/engine/credits.ts";
import { fishKey, fishModel, geminiKey } from "./env.ts";
import { acceptMessage, createRoom, getRoom, messagesAfter } from "./rooms.ts";
import { rewriteLine } from "./rewrite.ts";
import { FishError, synthesize } from "./tts.ts";

const recentSpeaks = new Map<string, number[]>();
const recentRewrites = new Map<string, number[]>();
const ROOM_ID = /^[a-z0-9-]{6,40}$/;

export type ApiRequest = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ResponseHelpers = ServerResponse & {
  status?: (code: number) => ResponseHelpers;
  json?: (body: unknown) => void;
  send?: (body: Buffer | string) => void;
};

export type ApiResponse = ResponseHelpers;

export function replyJson(res: ApiResponse, status: number, body: unknown): void {
  const sendJson = res.json;
  if (typeof res.status === "function" && typeof sendJson === "function") {
    res.status(status);
    sendJson.call(res, body);
    return;
  }
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function replyAudio(res: ApiResponse, audio: Buffer, headers: Record<string, string>): void {
  const send = res.send;
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  if (typeof res.status === "function" && typeof send === "function") {
    res.status(200);
    send.call(res, audio);
    return;
  }
  res.statusCode = 200;
  res.end(audio);
}

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

function tooMany(ip: string, bucket: Map<string, number[]>, limit: number): boolean {
  const now = Date.now();
  const window = (bucket.get(ip) ?? []).filter((stamp) => now - stamp < 60_000);
  if (window.length >= limit) {
    bucket.set(ip, window);
    return true;
  }
  window.push(now);
  bucket.set(ip, window);
  return false;
}

function tooManySpeaks(ip: string): boolean {
  return tooMany(ip, recentSpeaks, 20);
}

export function sendHealth(_req: ApiRequest, res: ApiResponse): void {
  const model = fishModel();
  replyJson(res, 200, {
    configured: Boolean(fishKey()),
    model,
    pricePerMillionBytes: usdPerMillionBytes(model),
    writer: geminiKey() ? "gemini" : "rules",
  });
}

export async function sendSpeech(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (tooManySpeaks(clientIp(req))) {
    replyJson(res, 429, { error: "The booth is catching its breath. Try again in a minute." });
    return;
  }

  const body = readBody(req) as { text?: unknown; characterId?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text : "";
  const characterId = typeof body?.characterId === "string" ? body.characterId : "";
  const character = getCharacter(characterId);
  if (!character) {
    replyJson(res, 400, { error: "Pick a character first." });
    return;
  }

  const line = await rewriteLine(text, character.id);
  if (!line.performance) {
    replyJson(res, 400, { error: "That line was empty." });
    return;
  }

  const apiKey = fishKey();
  if (!apiKey) {
    replyJson(res, 503, {
      error: "Add FISH_API_KEY to .env to speak with Fish Audio.",
      code: "unconfigured",
    });
    return;
  }

  const model = fishModel();
  try {
    const spoken = await synthesize(line.performance, character, model, apiKey);
    replyAudio(res, spoken.audio, {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "X-Booth-Cached": spoken.cached ? "hit" : "miss",
      "X-Booth-Model": model,
      "X-Booth-Bytes": String(spoken.bytes),
      "X-Booth-Usd": spoken.usd.toFixed(6),
      "X-Booth-Display": encodeURIComponent(line.display),
      "X-Booth-Writer": line.source,
    });
  } catch (error) {
    const status = error instanceof FishError ? error.status : 502;
    const message = error instanceof Error ? error.message : "Fish Audio did not answer.";
    const safeStatus = status === 401 || status === 402 || status === 429 ? status : 502;
    replyJson(res, safeStatus, { error: message });
  }
}

export async function sendRewrite(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (tooMany(clientIp(req), recentRewrites, 40)) {
    replyJson(res, 429, { error: "The booth is catching its breath. Try again in a minute." });
    return;
  }
  const body = readBody(req) as { text?: unknown; characterId?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text : "";
  const characterId = typeof body?.characterId === "string" ? body.characterId : "";
  if (!getCharacter(characterId)) {
    replyJson(res, 400, { error: "Pick a character first." });
    return;
  }
  const line = await rewriteLine(text, characterId);
  if (!line.display) {
    replyJson(res, 400, { error: "That line was empty." });
    return;
  }
  replyJson(res, 200, line);
}

export function openRoom(_req: ApiRequest, res: ApiResponse): void {
  const room = createRoom();
  replyJson(res, 201, { id: room.id });
}

export function readRoom(req: ApiRequest, res: ApiResponse): void {
  const id = queryValue(req, "id");
  if (!ROOM_ID.test(id)) {
    replyJson(res, 400, { error: "That room name is not one of ours." });
    return;
  }
  const room = getRoom(id);
  if (!room) {
    replyJson(res, 404, { error: "That booth has closed." });
    return;
  }
  replyJson(res, 200, { id: room.id, messages: messagesAfter(room, queryValue(req, "after")) });
}

export async function postRoomMessage(req: ApiRequest, res: ApiResponse): Promise<void> {
  const id = queryValue(req, "id");
  if (!ROOM_ID.test(id)) {
    replyJson(res, 400, { error: "That room name is not one of ours." });
    return;
  }
  if (!getRoom(id)) {
    replyJson(res, 404, { error: "That booth has closed." });
    return;
  }
  const body = readBody(req) as { original?: unknown; characterId?: unknown } | null;
  const original = typeof body?.original === "string" ? body.original : "";
  const characterId = typeof body?.characterId === "string" ? body.characterId : "";
  const line = getCharacter(characterId) ? await rewriteLine(original, characterId) : undefined;
  const message = acceptMessage(id, body, line);
  if (!message) {
    replyJson(res, 400, { error: "That line could not be taken." });
    return;
  }
  replyJson(res, 201, message);
}
