import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Character } from "../src/engine/types.ts";
import { estimateUsd, utf8Bytes } from "../src/engine/credits.ts";

const cacheDir = path.resolve(".cache/tts");
const inflight = new Map<string, Promise<Buffer>>();

export class FishError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function cacheKey(parts: unknown): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

async function requestSpeech(
  performance: string,
  character: Character,
  model: string,
  apiKey: string,
): Promise<Buffer> {
  const response = await fetch("https://api.fish.audio/v1/tts", {
    method: "POST",
    signal: AbortSignal.timeout(45_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      model,
    },
    body: JSON.stringify({
      text: performance,
      reference_id: character.voiceId,
      format: "mp3",
      mp3_bitrate: 128,
      latency: "balanced",
      temperature: character.temperature,
      top_p: 0.7,
      normalize: true,
      language: "en",
      prosody: {
        speed: character.speed,
        volume: 0,
        normalize_loudness: true,
      },
    }),
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || contentType.includes("application/json")) {
    let message = `Fish Audio returned ${response.status}.`;
    try {
      const body = (await response.json()) as { message?: unknown };
      if (typeof body.message === "string" && body.message.trim()) {
        message = body.message.trim().slice(0, 240);
      }
    } catch {
      message = `Fish Audio returned ${response.status}.`;
    }
    throw new FishError(message, response.status || 502);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length < 64) {
    throw new FishError("Fish Audio returned empty audio.", 502);
  }
  return audio;
}

export async function synthesize(
  performance: string,
  character: Character,
  model: string,
  apiKey: string,
): Promise<{ audio: Buffer; cached: boolean; bytes: number; usd: number }> {
  const bytes = utf8Bytes(performance);
  const key = cacheKey({
    model,
    voiceId: character.voiceId,
    performance,
    speed: character.speed,
    temperature: character.temperature,
  });
  const file = path.join(cacheDir, `${key}.mp3`);

  if (existsSync(file)) {
    return { audio: readFileSync(file), cached: true, bytes, usd: 0 };
  }

  let pending = inflight.get(key);
  const first = !pending;
  if (!pending) {
    pending = requestSpeech(performance, character, model, apiKey).then((audio) => {
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(file, audio);
      return audio;
    });
    inflight.set(key, pending);
  }

  try {
    const audio = await pending;
    return {
      audio,
      cached: !first,
      bytes,
      usd: first ? estimateUsd(model, bytes) : 0,
    };
  } finally {
    if (first) inflight.delete(key);
  }
}
