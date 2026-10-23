import { existsSync, readFileSync } from "node:fs";

/** Load .env without overriding variables the shell already set. */
export function loadEnv(file = ".env"): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

const MODELS = new Set(["s2.1-pro-free", "s2.1-pro", "s2-pro", "drama-3"]);

export function fishModel(): string {
  const requested = process.env.FISH_MODEL?.trim() || "s2.1-pro-free";
  return MODELS.has(requested) ? requested : "s2.1-pro-free";
}

export function fishKey(): string | undefined {
  const key = process.env.FISH_API_KEY?.trim();
  return key ? key : undefined;
}

export function geminiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key ? key : undefined;
}

export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
}
