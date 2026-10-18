import { randomBytes } from "node:crypto";
import { getCharacter } from "../src/engine/characters.ts";
import { translate } from "../src/engine/translate.ts";
import type { BoothMessage, SeatId } from "../src/engine/types.ts";

type Room = {
  id: string;
  createdAt: number;
  messages: BoothMessage[];
};

const rooms = new Map<string, Room>();
const MAX_ROOMS = 100;
const MAX_MESSAGES = 80;
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;

const ADJECTIVES = ["amber", "quiet", "brass", "paper", "velvet", "late", "warm", "low"];
const NOUNS = ["dock", "booth", "lamp", "line", "reel", "night", "chair", "desk"];

function prune(): void {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (now - room.createdAt > ROOM_TTL_MS) rooms.delete(id);
  }
  while (rooms.size > MAX_ROOMS) {
    const oldest = rooms.keys().next().value;
    if (!oldest) break;
    rooms.delete(oldest);
  }
}

export function createRoom(): Room {
  prune();
  const adjective = ADJECTIVES[randomBytes(1)[0] % ADJECTIVES.length];
  const noun = NOUNS[randomBytes(1)[0] % NOUNS.length];
  const suffix = randomBytes(2).toString("hex");
  const id = `${adjective}-${noun}-${suffix}`;
  const room: Room = { id, createdAt: Date.now(), messages: [] };
  rooms.set(id, room);
  return room;
}

export function getRoom(id: string): Room | undefined {
  prune();
  return rooms.get(id);
}

function asSeat(value: unknown): SeatId | null {
  return value === "you" || value === "them" ? value : null;
}

export function acceptMessage(roomId: string, input: unknown): BoothMessage | null {
  const room = getRoom(roomId);
  if (!room || !input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const seat = asSeat(record.seat);
  const characterId = typeof record.characterId === "string" ? record.characterId : "";
  const original = typeof record.original === "string" ? record.original.trim() : "";
  const id = typeof record.id === "string" ? record.id : "";
  if (!seat || !getCharacter(characterId) || !original || !/^[A-Za-z0-9-]{8,80}$/.test(id)) {
    return null;
  }

  const existing = room.messages.find((message) => message.id === id);
  if (existing) return existing;

  const translation = translate(original, characterId);
  if (!translation.display) return null;

  const message: BoothMessage = {
    id,
    seat,
    characterId,
    original: original.slice(0, 500),
    display: translation.display,
    triggers: translation.triggers,
    createdAt: Date.now(),
  };
  room.messages.push(message);
  if (room.messages.length > MAX_MESSAGES) {
    room.messages.splice(0, room.messages.length - MAX_MESSAGES);
  }
  return message;
}

export function messagesAfter(room: Room, afterId: string): BoothMessage[] {
  if (!afterId) return room.messages;
  const index = room.messages.findIndex((message) => message.id === afterId);
  if (index === -1) return room.messages;
  return room.messages.slice(index + 1);
}
