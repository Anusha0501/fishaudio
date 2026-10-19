import type { SeatId } from "./types";

export type SceneLine = {
  seat: SeatId;
  characterId: string;
  text: string;
};

/** Michael opens. Dwight answers. The catchphrase has to land twice. */
export const DEMO_SCENE: SceneLine[] = [
  {
    seat: "you",
    characterId: "michael",
    text: "This quarterly report is really hard.",
  },
  {
    seat: "them",
    characterId: "dwight",
    text: "Who signed this, and why are the numbers late?",
  },
  {
    seat: "you",
    characterId: "michael",
    text: "I need the whole team to come in on Saturday.",
  },
  {
    seat: "them",
    characterId: "dwight",
    text: "Those numbers are wrong.",
  },
];
