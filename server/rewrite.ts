import { getCharacter } from "../src/engine/characters.ts";
import { stageLine, translate } from "../src/engine/translate.ts";
import type { Translation } from "../src/engine/types.ts";
import { geminiKey, geminiModel } from "./env.ts";

export type Rewrite = Translation & { source: "gemini" | "rules" };

const cache = new Map<string, Rewrite>();
const inflight = new Map<string, Promise<Rewrite>>();

const BRIEFS: Record<string, string> = {
  michael:
    'Michael Scott, regional manager of a paper company. Eager, sincere, and a little too much. He says "here\'s the thing." Add "That\'s what she said." only when the sentence has an accidental double meaning. Otherwise leave that joke out.',
  dwight:
    'Dwight Schrute. Flat, certain, and corrective. No warmth. Say "False." only when the sentence is wrong. Mention bears, beets, or Battlestar Galactica only if a farm or those words are already in the sentence.',
  jim:
    'Jim Halpert. Dry, relaxed, and slightly amused, as if he might glance at a camera. Keep it understated. Add "Yeah, so that happened." only for a pointless meeting.',
  pam:
    'Pam Beesly, a receptionist. Warm, polite, and unhurried. Use "Dunder Mifflin, this is Pam." only when she is answering the phone. Mention art school only if art is already in the sentence.',
};

function cleanLine(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function fromRules(raw: string, characterId: string): Rewrite {
  return { ...translate(raw, characterId), source: "rules" };
}

async function askGemini(text: string, characterId: string, apiKey: string): Promise<string> {
  const character = getCharacter(characterId);
  const brief = BRIEFS[character?.id ?? ""] ?? BRIEFS.michael;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel())}:generateContent`,
    {
      method: "POST",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: `Rewrite the user's sentence as one or two short spoken sentences. Keep the meaning. Do not add facts they did not imply. No quotation marks, labels, or stage directions. ${brief} Reply as JSON with a single "line" string.`,
            },
          ],
        },
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 180,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: { line: { type: "STRING" } },
            required: ["line"],
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 180);
    throw new Error(`Gemini returned ${response.status}. ${detail}`);
  }

  const body = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const raw = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  try {
    const parsed = JSON.parse(raw) as { line?: unknown };
    if (typeof parsed.line === "string") return cleanLine(parsed.line);
  } catch {
    const match = raw.match(/"line"\s*:\s*"([^"]+)"/);
    if (match?.[1]) return cleanLine(match[1]);
  }
  return cleanLine(raw);
}

async function rewriteFresh(text: string, characterId: string): Promise<Rewrite> {
  const fallback = fromRules(text, characterId);
  const apiKey = geminiKey();
  const id = getCharacter(characterId)?.id ?? "plain";
  if (!apiKey || id === "plain" || !fallback.display) return fallback;

  try {
    const line = await askGemini(text, id, apiKey);
    if (!line) return fallback;
    return {
      display: line,
      performance: stageLine(id, line),
      triggers: [],
      source: "gemini",
    };
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Gemini did not answer.");
    return fallback;
  }
}

export function rewriteLine(text: string, characterId: string): Promise<Rewrite> {
  const id = getCharacter(characterId)?.id ?? "plain";
  const key = `${id}\n${text.trim()}`;
  const saved = cache.get(key);
  if (saved) return Promise.resolve(saved);
  const pending = inflight.get(key);
  if (pending) return pending;

  const next = rewriteFresh(text, characterId).then((line) => {
    inflight.delete(key);
    if (line.display) cache.set(key, line);
    return line;
  });
  inflight.set(key, next);
  return next;
}
