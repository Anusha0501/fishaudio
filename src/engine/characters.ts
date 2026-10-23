import type { Character } from "./types";

/**
 * Dunder Mifflin cast, spoken with public Fish Audio narrators.
 * The names and habits are the characters'. The voices are not the actors'.
 * Swap `voiceId` for any id from https://fish.audio
 */
export const CHARACTERS: Character[] = [
  {
    id: "michael",
    name: "Michael Scott",
    role: "Regional Manager",
    signature: "That's what she said.",
    blurb: "Regional Manager of Dunder Mifflin Scranton. A plain word is enough.",
    voiceId: "bf322df2096a46f18c579d0baa36f41d",
    voiceName: "Adrian",
    monogram: "MS",
    portrait: "/cast/michael.jpg",
    hue: 28,
    speed: 1.05,
    temperature: 0.85,
    sample: "This quarterly report is really hard.",
  },
  {
    id: "dwight",
    name: "Dwight Schrute",
    role: "Assistant Regional Manager",
    signature: "False.",
    blurb: "Assistant Regional Manager. He will correct the title, then the fact.",
    voiceId: "319010b746ea48fe8137531bb52caa49",
    voiceName: "Deep Calm Narrator",
    monogram: "DS",
    portrait: "/cast/dwight.jpg",
    hue: 78,
    speed: 0.94,
    temperature: 0.5,
    sample: "Those numbers are wrong.",
  },
  {
    id: "jim",
    name: "Jim Halpert",
    role: "Sales",
    signature: "Yeah, so that happened.",
    blurb: "Sales. He lets a meeting hang, then looks at the camera.",
    voiceId: "9a9cf47702da476aa4629e2506d4a857",
    voiceName: "Energetic Male",
    monogram: "JH",
    portrait: "/cast/jim.jpg",
    hue: 210,
    speed: 0.98,
    temperature: 0.6,
    sample: "This meeting is going to run long.",
  },
  {
    id: "pam",
    name: "Pam Beesly",
    role: "Reception",
    signature: "Dunder Mifflin, this is Pam.",
    blurb: "Reception. She answers the phone, and sometimes mentions art school.",
    voiceId: "c70cfb98867a4bfb9ae20d2401257b92",
    voiceName: "Delia",
    monogram: "PB",
    portrait: "/cast/pam.jpg",
    hue: 330,
    speed: 0.96,
    temperature: 0.65,
    sample: "I might take an art class again.",
  },
];

export const PLAIN: Character = {
  id: "plain",
  name: "As yourself",
  role: "No character",
  signature: "Your words, unchanged.",
  blurb: "The line leaves the way it arrived.",
  voiceId: "f3a2b90078d54a65af4b95f63bc7798e",
  voiceName: "Sheila",
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
