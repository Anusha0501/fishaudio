import type { Character } from "./types";

/**
 * Original personas on public Fish Audio library voices.
 * These are narrators, not impressions of real people.
 * Swap `voiceId` for any id from https://fish.audio
 */
export const CHARACTERS: Character[] = [
  {
    id: "reggie",
    name: "Reggie Dunn",
    role: "Regional manager",
    signature: "That's what she said.",
    blurb:
      "Means every compliment. Lands on the obvious joke the moment a plain word can hold it.",
    voiceId: "9a9cf47702da476aa4629e2506d4a857",
    voiceName: "Energetic Male",
    monogram: "RD",
    hue: 28,
    speed: 1.05,
    temperature: 0.85,
    sample: "This quarterly report is really hard.",
  },
  {
    id: "vera",
    name: "Vera Vale",
    role: "Night detective",
    signature: "The city keeps the receipt.",
    blurb: "Short sentences. She treats a late answer like evidence.",
    voiceId: "89f41ea230034706881f85a8227d6ab9",
    voiceName: "British female narrator",
    monogram: "VV",
    hue: 210,
    speed: 0.92,
    temperature: 0.55,
    sample: "Where were you when the money went missing?",
  },
  {
    id: "ivo",
    name: "Captain Ivo",
    role: "Ferry captain",
    signature: "Steady. The dock will still be there.",
    blurb: "Deadpan, logged, and unwilling to hurry a heading.",
    voiceId: "1ca5d32c6b9f432db87be6fdbca86bfd",
    voiceName: "Deep British Narrator",
    monogram: "CI",
    hue: 168,
    speed: 0.9,
    temperature: 0.5,
    sample: "We're going to be late to the launch.",
  },
  {
    id: "lumen",
    name: "Lumen Park",
    role: "Overnight host",
    signature: "This one goes out to the people still awake.",
    blurb: "Turns a sentence into a dedication and a win into a record.",
    voiceId: "9cf30df1a9b34666983695dc6fc338d2",
    voiceName: "Energetic Female Announcer",
    monogram: "LP",
    hue: 322,
    speed: 1.08,
    temperature: 0.8,
    sample: "Play our song one more time.",
  },
];

export const PLAIN: Character = {
  id: "plain",
  name: "As yourself",
  role: "No character",
  signature: "Your words, unchanged.",
  blurb: "The line leaves the way it arrived.",
  voiceId: "319010b746ea48fe8137531bb52caa49",
  voiceName: "Deep Calm Narrator",
  monogram: "You",
  hue: 40,
  speed: 1,
  temperature: 0.7,
  sample: "I'll be there in ten minutes.",
};

const BY_ID = new Map<string, Character>(
  [...CHARACTERS, PLAIN].map((character) => [character.id, character]),
);

export function getCharacter(id: string): Character | undefined {
  return BY_ID.get(id);
}

export function listCharacters(): Character[] {
  return CHARACTERS;
}
