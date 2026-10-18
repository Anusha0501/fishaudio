import type { SeatId } from "./types";

export type SceneLine = {
  seat: SeatId;
  characterId: string;
  text: string;
};

/** A four-line scene that shows the catch landing, then the other chair answering. */
export const DEMO_SCENE: SceneLine[] = [
  {
    seat: "you",
    characterId: "reggie",
    text: "This quarterly report is really hard.",
  },
  {
    seat: "them",
    characterId: "vera",
    text: "Then tell me who signed it, and why the numbers came in late.",
  },
  {
    seat: "you",
    characterId: "reggie",
    text: "I need the whole team to come in on Saturday.",
  },
  {
    seat: "them",
    characterId: "vera",
    text: "Bring the timeline. Leave the apology.",
  },
];
