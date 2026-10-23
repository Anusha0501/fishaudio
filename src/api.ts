import { translate } from "./engine/translate";
import type { BoothMessage, Translation } from "./engine/types";

export type Health = {
  configured: boolean;
  model: string;
  pricePerMillionBytes: number;
  writer?: "groq" | "gemini" | "rules";
};

export class SpeakError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export type Spoken = {
  blob: Blob;
  usd: number;
  cached: boolean;
  model: string;
  display: string;
  writer: string;
};

export async function fetchHealth(): Promise<Health> {
  const response = await fetch("/api/health");
  if (!response.ok) throw new Error("The booth could not check its voice line.");
  return (await response.json()) as Health;
}

export async function speakLine(text: string, characterId: string): Promise<Spoken> {
  const response = await fetch("/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, characterId }),
  });

  if (!response.ok) {
    let message = "Fish Audio did not answer.";
    let code = "fish";
    try {
      const body = (await response.json()) as { error?: string; code?: string };
      if (body.error) message = body.error;
      if (body.code) code = body.code;
    } catch {
      message = `Fish Audio returned ${response.status}.`;
    }
    throw new SpeakError(message, code, response.status);
  }

  return {
    blob: await response.blob(),
    usd: Number(response.headers.get("X-Booth-Usd") ?? 0),
    cached: response.headers.get("X-Booth-Cached") === "hit",
    model: response.headers.get("X-Booth-Model") ?? "",
    display: decodeURIComponent(response.headers.get("X-Booth-Display") ?? ""),
    writer: response.headers.get("X-Booth-Writer") ?? "",
  };
}

export async function rewriteLine(text: string, characterId: string): Promise<Translation> {
  const response = await fetch("/api/rewrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, characterId }),
  });
  if (!response.ok) return translate(text, characterId);
  return (await response.json()) as Translation & { source?: "groq" | "gemini" | "rules" };
}

const roomBoot = new Map<string, Promise<string>>();

async function roomExists(id: string): Promise<boolean> {
  const response = await fetch(`/api/rooms/${encodeURIComponent(id)}`);
  return response.ok;
}

export function ensureRoom(requested: string | null): Promise<string> {
  const key = requested ?? "";
  const existing = roomBoot.get(key);
  if (existing) return existing;

  const pending = (async () => {
    if (requested && (await roomExists(requested))) return requested;
    const response = await fetch("/api/rooms", { method: "POST" });
    if (!response.ok) throw new Error("The booth could not open a room.");
    const body = (await response.json()) as { id: string };
    return body.id;
  })();

  roomBoot.set(key, pending);
  return pending;
}

export async function publishMessage(roomId: string, message: BoothMessage): Promise<void> {
  const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "The other chair did not get that line.");
  }
}

export async function pullMessages(roomId: string, after: string): Promise<BoothMessage[]> {
  const response = await fetch(
    `/api/rooms/${encodeURIComponent(roomId)}?after=${encodeURIComponent(after)}`,
  );
  if (!response.ok) return [];
  const body = (await response.json()) as { messages: BoothMessage[] };
  return body.messages;
}

export function playBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  return new Promise((resolve, reject) => {
    const finish = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onended = finish;
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The audio could not play."));
    };
    void audio.play().catch((error: unknown) => {
      URL.revokeObjectURL(url);
      reject(error instanceof Error ? error : new Error("The audio could not play."));
    });
  });
}

export function browserSpeak(text: string, characterId: string, speed: number): Promise<void> {
  if (!("speechSynthesis" in window)) {
    return Promise.reject(new Error("This browser has no speaking voice."));
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = Math.min(1.4, Math.max(0.8, speed));
  const voices = window.speechSynthesis.getVoices();
  const female = voices.find((voice) => /female|samantha|victoria|karen|moira|fiona|serena/i.test(voice.name));
  const male = voices.find((voice) => /daniel|alex|fred|rishi|male|gordon/i.test(voice.name));
  const picked = characterId === "pam" ? female : male;
  if (picked) utterance.voice = picked;
  utterance.pitch = characterId === "dwight" ? 0.82 : characterId === "pam" ? 1.08 : 1;
  window.speechSynthesis.cancel();
  return new Promise((resolve, reject) => {
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error("The browser voice stopped."));
    window.speechSynthesis.speak(utterance);
  });
}
