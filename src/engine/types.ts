export type SeatId = "you" | "them";

export type TriggerHit = {
  id: string;
  label: string;
  phrase: string;
};

export type Translation = {
  display: string;
  performance: string;
  triggers: TriggerHit[];
};

export type Character = {
  id: string;
  name: string;
  role: string;
  signature: string;
  blurb: string;
  voiceId: string;
  voiceName: string;
  monogram: string;
  /** Hue for the character's lamp and card, 0–360. */
  hue: number;
  speed: number;
  temperature: number;
  sample: string;
};

export type BoothMessage = {
  id: string;
  seat: SeatId;
  characterId: string;
  original: string;
  display: string;
  triggers: TriggerHit[];
  createdAt: number;
};
