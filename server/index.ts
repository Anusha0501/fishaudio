import path from "node:path";
import express from "express";
import { estimateUsd } from "../src/engine/credits.ts";
import { fishKey, fishModel, loadEnv } from "./env.ts";
import { openRoom, postRoomMessage, readRoom, sendHealth, sendSpeech, type ApiRequest } from "./handlers.ts";

loadEnv();

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

function asApi(req: express.Request): ApiRequest {
  return Object.assign(req, { query: req.query as ApiRequest["query"] });
}

app.get("/api/health", (req, res) => {
  sendHealth(asApi(req), res);
});

app.post("/api/speak", (req, res) => {
  void sendSpeech(asApi(req), res);
});

app.post("/api/rooms", (req, res) => {
  openRoom(asApi(req), res);
});

app.get("/api/rooms/:id", (req, res) => {
  const api = asApi(req);
  api.query = { ...api.query, id: req.params.id };
  readRoom(api, res);
});

app.post("/api/rooms/:id/messages", (req, res) => {
  const api = asApi(req);
  api.query = { ...api.query, id: req.params.id };
  postRoomMessage(api, res);
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
} else if (!process.env.VERCEL) {
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

export default app;
