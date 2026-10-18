import path from "node:path";
import express from "express";
import { getCharacter } from "../src/engine/characters.ts";
import { estimateUsd, PAID_TTS_USD_PER_MILLION_BYTES } from "../src/engine/credits.ts";
import { translate } from "../src/engine/translate.ts";
import { fishKey, fishModel, loadEnv } from "./env.ts";
import { acceptMessage, createRoom, getRoom, messagesAfter } from "./rooms.ts";
import { FishError, synthesize } from "./tts.ts";

loadEnv();

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

const recentSpeaks = new Map<string, number[]>();

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

app.get("/api/health", (_req, res) => {
  const model = fishModel();
  res.json({
    configured: Boolean(fishKey()),
    model,
    pricePerMillionBytes: model === "s2.1-pro-free" ? 0 : PAID_TTS_USD_PER_MILLION_BYTES,
  });
});

app.post("/api/speak", async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || "local";
  if (tooManySpeaks(ip)) {
    res.status(429).json({ error: "The booth is catching its breath. Try again in a minute." });
    return;
  }

  const text = typeof req.body?.text === "string" ? req.body.text : "";
  const characterId = typeof req.body?.characterId === "string" ? req.body.characterId : "";
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
});

app.post("/api/rooms", (_req, res) => {
  const room = createRoom();
  res.status(201).json({ id: room.id });
});

app.get("/api/rooms/:id", (req, res) => {
  const id = req.params.id;
  if (!/^[a-z0-9-]{6,40}$/.test(id)) {
    res.status(400).json({ error: "That room name is not one of ours." });
    return;
  }
  const room = getRoom(id);
  if (!room) {
    res.status(404).json({ error: "That booth has closed." });
    return;
  }
  const after = typeof req.query.after === "string" ? req.query.after : "";
  res.json({ id: room.id, messages: messagesAfter(room, after) });
});

app.post("/api/rooms/:id/messages", (req, res) => {
  const id = req.params.id;
  if (!/^[a-z0-9-]{6,40}$/.test(id)) {
    res.status(400).json({ error: "That room name is not one of ours." });
    return;
  }
  if (!getRoom(id)) {
    res.status(404).json({ error: "That booth has closed." });
    return;
  }
  const message = acceptMessage(id, req.body);
  if (!message) {
    res.status(400).json({ error: "That line could not be taken." });
    return;
  }
  res.status(201).json(message);
});

const port = Number(process.env.PORT || 5173);
const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  const dist = path.resolve("dist");
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api") || req.path.includes(".")) {
      next();
      return;
    }
    res.sendFile(path.join(dist, "index.html"));
  });
  app.listen(port, () => {
    console.log(`Booth is live at http://localhost:${port}`);
  });
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: { port: 5174 } },
    appType: "spa",
  });
  app.use(vite.middlewares);
  app.listen(port, "127.0.0.1", () => {
    console.log(`Booth is live at http://127.0.0.1:${port}`);
    console.log(
      fishKey()
        ? `Fish Audio model: ${fishModel()} (a line costs about ${estimateUsd(fishModel(), 200).toFixed(4)} USD before cache)`
        : "No FISH_API_KEY yet. Lines still restyle. Speech uses the browser voice.",
    );
  });
}
