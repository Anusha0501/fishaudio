import { getCharacter } from "./characters";
import type { Translation, TriggerHit } from "./types";

type Swap = [RegExp, string];

type Rule = {
  id: string;
  label: string;
  pattern: RegExp;
  line: string;
  when: "always" | "short-or-intense";
};

type Styled = {
  body: string;
  closer: string | null;
  triggers: TriggerHit[];
};

const MAX_INPUT = 500;

const REGGIE_RULES: Rule[] = [
  { id: "come-in", label: "come in", pattern: /\bcome in\b/i, line: "That's what she said.", when: "always" },
  {
    id: "went-long",
    label: "went long",
    pattern: /\b(?:went|goes|going|ran|runs) long\b/i,
    line: "That's what she said.",
    when: "always",
  },
  { id: "all-night", label: "all night", pattern: /\ball night\b/i, line: "That's what she said.", when: "always" },
  { id: "too-much", label: "too much", pattern: /\btoo much\b/i, line: "That's what she said.", when: "always" },
  { id: "nail-it", label: "nail it", pattern: /\bnail it\b/i, line: "That's what she said.", when: "always" },
  { id: "on-top", label: "on top", pattern: /\bon top\b/i, line: "That's what she said.", when: "always" },
  { id: "all-the-way", label: "all the way", pattern: /\ball the way\b/i, line: "That's what she said.", when: "always" },
  { id: "hard", label: "hard", pattern: /\bhard(?:er|est)?\b(?!-)/i, line: "That's what she said.", when: "short-or-intense" },
  { id: "long", label: "long", pattern: /\blong(?:er|est)?\b(?!-)/i, line: "That's what she said.", when: "short-or-intense" },
  { id: "big", label: "big", pattern: /\bbig(?:ger|gest)?\b(?!-)/i, line: "That's what she said.", when: "short-or-intense" },
  { id: "huge", label: "huge", pattern: /\b(?:huge|enormous|massive)\b/i, line: "That's what she said.", when: "short-or-intense" },
  { id: "deep", label: "deep", pattern: /\bdeep(?:er|est)?\b/i, line: "That's what she said.", when: "short-or-intense" },
  { id: "tight", label: "tight", pattern: /\btight(?:er|est)?\b/i, line: "That's what she said.", when: "short-or-intense" },
  { id: "handle", label: "handle", pattern: /\bhandle\b/i, line: "That's what she said.", when: "short-or-intense" },
  { id: "finish", label: "finish", pattern: /\bfinish(?:ed)?\b/i, line: "That's what she said.", when: "short-or-intense" },
  { id: "coming", label: "coming", pattern: /\bcoming\b/i, line: "That's what she said.", when: "short-or-intense" },
  { id: "heart", label: "the team", pattern: /\b(?:team|staff|everyone)\b/i, line: "I mean that from the heart.", when: "always" },
];

const VERA_RULES: Rule[] = [
  { id: "secret", label: "a secret", pattern: /\b(?:secret|lie|lied|missing)\b/i, line: "The city keeps the receipt.", when: "always" },
  { id: "money", label: "money", pattern: /\b(?:money|cash|paid|payment)\b/i, line: "The city keeps the receipt.", when: "always" },
  { id: "late", label: "late", pattern: /\b(?:late|delay|delayed)\b/i, line: "The city keeps the receipt.", when: "always" },
  { id: "who", label: "who", pattern: /\b(?:who|why)\b/i, line: "The city keeps the receipt.", when: "always" },
];

const IVO_RULES: Rule[] = [
  {
    id: "late",
    label: "the clock",
    pattern: /\b(?:late|deadline|hurry|hurried|soon)\b/i,
    line: "Steady. The dock will still be there.",
    when: "always",
  },
  {
    id: "trouble",
    label: "trouble",
    pattern: /\b(?:problem|broken|fail|failed|failure|crash|danger|stuck)\b/i,
    line: "We don't panic on my deck.",
    when: "always",
  },
];

const LUMEN_RULES: Rule[] = [
  {
    id: "dedication",
    label: "a dedication",
    pattern: /\b(?:song|songs|love|miss|heart|dedicate|dedication|tonight)\b/i,
    line: "This one goes out to the people still awake.",
    when: "always",
  },
];

const REGGIE_SWAPS: Swap[] = [
  [/^(?:hey|hi|hello)[.!]?$/i, "Hey. Welcome to the branch"],
  [/\bi think\b/gi, "here's the thing, I think"],
  [/\bsorry\b/gi, "don't be sorry"],
  [/^(?:yes|yeah|yep)[.!]?$/i, "Absolutely"],
  [/^(?:no|nope)[.!]?$/i, "I'm gonna stop you right there"],
];

const VERA_SWAPS: Swap[] = [
  [/^(?:hey|hi|hello)[.!]?$/i, "You found the office. Most people don't"],
  [/^(?:yes|yeah|yep)[.!]?$/i, "That's the shape of it"],
  [/^(?:no|nope)[.!]?$/i, "Not from where I'm standing"],
  [/\bi don't know\b/gi, "The file is thin on that"],
  [/\bsorry\b/gi, "Save the apology"],
];

const IVO_SWAPS: Swap[] = [
  [/^(?:hey|hi|hello)[.!]?$/i, "Station's open. State your heading"],
  [/^(?:yes|yeah|yep)[.!]?$/i, "Logged"],
  [/^(?:no|nope)[.!]?$/i, "Negative"],
  [/\bthank(?:s| you)\b/gi, "Noted, with thanks"],
];

const LUMEN_SWAPS: Swap[] = [
  [/^(?:hey|hi|hello)[.!]?$/i, "You're live on the overnight"],
  [/^(?:yes|yeah|yep)[.!]?$/i, "That's a yes from the booth"],
  [/^(?:no|nope)[.!]?$/i, "Not on this frequency"],
];

export function guard(raw: string): string {
  return raw
    .replace(/<\|[^|>]{0,40}\|>/g, " ")
    .replace(/\[[^\]\n]{0,80}\]/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_INPUT);
}

function tidy(text: string): string {
  let next = text.replace(/\s+/g, " ").trim();
  if (!next) return "";
  next = next.replace(/\bi\b/g, "I");
  next = next[0].toUpperCase() + next.slice(1);
  if (!/[.?!…]$/.test(next)) next += ".";
  return next;
}

function applySwaps(text: string, swaps: Swap[]): string {
  let next = text;
  for (const [pattern, replacement] of swaps) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

function pick(text: string, rules: Rule[]): (TriggerHit & { line: string }) | null {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const intense = /\b(?:really|so|too|very|super|pretty|quite|extremely|incredibly|such)\b/i.test(text);
  for (const rule of rules) {
    const match = text.match(rule.pattern);
    if (!match?.[0]) continue;
    if (rule.when === "short-or-intense" && words > 18 && !intense) continue;
    return { id: rule.id, label: rule.label, phrase: match[0], line: rule.line };
  }
  return null;
}

function signatureOf(closer: string): string {
  return closer.replace(/[.?!…]$/, "").toLowerCase();
}

function alreadySaid(body: string, closer: string): boolean {
  return body.toLowerCase().includes(signatureOf(closer));
}

function join(body: string, closer: string): string {
  if (alreadySaid(body, closer)) return body;
  if (/[?!]$/.test(body)) return `${body} ${closer}`;
  const bare = body.replace(/[.…]+$/, "");
  return `${bare}. ${closer}`;
}

function script(
  id: string,
  body: string,
  closer: string | null,
  hit: TriggerHit | null,
): string {
  if (id === "plain") return closer ? join(body, closer) : body;

  const catchphrase = Boolean(hit && hit.id !== "heart");
  const lead =
    id === "reggie"
      ? catchphrase
        ? "[excited]"
        : "[friendly]"
      : id === "vera"
        ? "[calm]"
        : id === "ivo"
          ? "[confident]"
          : "[excited]";

  const closerTag =
    id === "reggie" && catchphrase
      ? "[chuckling]"
      : id === "vera" && hit
        ? "[quiet]"
        : id === "ivo" && hit
          ? "[calm]"
          : id === "lumen" && closer
            ? "[delighted]"
            : "";

  if (!closer) return `${lead} ${body}`.trim();
  const tail = [closerTag, closer].filter(Boolean).join(" ");
  if (/[?!]$/.test(body)) return `${lead} ${body} [break] ${tail}`.trim();
  const bare = body.replace(/[.…]+$/, "");
  return `${lead} ${bare}. [break] ${tail}`.trim();
}

function styleReggie(text: string): Styled {
  const hit = pick(text, REGGIE_RULES);
  return {
    body: applySwaps(text, REGGIE_SWAPS),
    closer: hit?.line ?? null,
    triggers: hit ? [hit] : [],
  };
}

function styleVera(text: string): Styled {
  const hit = pick(text, VERA_RULES);
  const closer = hit?.line ?? (text.endsWith("?") ? "Ask it once more, slower." : null);
  return {
    body: applySwaps(text, VERA_SWAPS),
    closer,
    triggers: hit ? [hit] : [],
  };
}

function styleIvo(text: string): Styled {
  const hit = pick(text, IVO_RULES);
  return {
    body: applySwaps(text, IVO_SWAPS),
    closer: hit?.line ?? null,
    triggers: hit ? [hit] : [],
  };
}

function styleLumen(text: string): Styled {
  const hit = pick(text, LUMEN_RULES);
  const closer = hit?.line ?? (text.includes("!") ? "And that is the record." : null);
  return {
    body: applySwaps(text, LUMEN_SWAPS),
    closer,
    triggers: hit ? [hit] : [],
  };
}

function stylePlain(text: string): Styled {
  return { body: text, closer: null, triggers: [] };
}

const STYLES: Record<string, (text: string) => Styled> = {
  reggie: styleReggie,
  vera: styleVera,
  ivo: styleIvo,
  lumen: styleLumen,
  plain: stylePlain,
};

export function translate(raw: string, characterId: string): Translation {
  const guarded = guard(raw);
  if (!guarded) return { display: "", performance: "", triggers: [] };

  const known = getCharacter(characterId);
  const id = known?.id ?? "plain";
  const style = STYLES[id] ?? stylePlain;
  const styled = style(guarded);
  const body = tidy(styled.body);
  const closer =
    styled.closer && !alreadySaid(body, styled.closer) ? styled.closer : null;
  const display = closer ? join(body, closer) : body;
  const performance = script(id, body, closer, styled.triggers[0] ?? null);
  return {
    display,
    performance,
    triggers: styled.triggers.map(({ id, label, phrase }) => ({ id, label, phrase })),
  };
}
