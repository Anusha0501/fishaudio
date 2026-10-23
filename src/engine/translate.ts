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

const MICHAEL_RULES: Rule[] = [
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
  { id: "friend", label: "the team", pattern: /\b(?:team|staff|everyone)\b/i, line: "I am a friend first, and a boss second.", when: "always" },
];

const DWIGHT_RULES: Rule[] = [
  { id: "title", label: "his title", pattern: /\bassistant to the\b/i, line: "Assistant Regional Manager.", when: "always" },
  { id: "farm", label: "the farm", pattern: /\b(?:bears?|beets?|farm)\b/i, line: "Bears. Beets. Battlestar Galactica.", when: "always" },
  { id: "false", label: "false", pattern: /\b(?:false|wrong|incorrect)\b/i, line: "False.", when: "always" },
  { id: "security", label: "security", pattern: /\b(?:security|fire|thief|steal|danger)\b/i, line: "Identity theft is not a joke.", when: "always" },
  { id: "late", label: "late", pattern: /\b(?:late|deadline)\b/i, line: "That is your emergency, not mine.", when: "always" },
];

const JIM_RULES: Rule[] = [
  { id: "prank", label: "Dwight", pattern: /\b(?:dwight|stapler|prank)\b/i, line: "His stapler might be in Jell-O.", when: "always" },
  { id: "meeting", label: "the meeting", pattern: /\b(?:meeting|conference|agenda)\b/i, line: "Yeah, so that happened.", when: "always" },
];

const PAM_RULES: Rule[] = [
  { id: "art", label: "art", pattern: /\b(?:art|draw|drawing|paint|painting)\b/i, line: "I went to art school. Sort of.", when: "always" },
  { id: "desk", label: "reception", pattern: /\b(?:phone|call|hold|reception|desk)\b/i, line: "Can you hold for one second?", when: "always" },
];

const MICHAEL_SWAPS: Swap[] = [
  [/^(?:hey|hi|hello)[.!]?$/i, "Hey. Welcome to Dunder Mifflin"],
  [/\bi think\b/gi, "here's the thing, I think"],
  [/\bsorry\b/gi, "don't be sorry"],
  [/^(?:yes|yeah|yep)[.!]?$/i, "Absolutely"],
  [/^(?:no|nope)[.!]?$/i, "I'm gonna stop you right there"],
];

const DWIGHT_SWAPS: Swap[] = [
  [/^(?:hey|hi|hello)[.!]?$/i, "Dwight Schrute. Assistant Regional Manager"],
  [/^(?:yes|yeah|yep)[.!]?$/i, "Correct"],
  [/^(?:no|nope)[.!]?$/i, "False"],
  [/\bi don't know\b/gi, "Then you should not be speaking"],
];

const JIM_SWAPS: Swap[] = [
  [/^(?:hey|hi|hello)[.!]?$/i, "Hey. Jim Halpert"],
  [/^(?:yes|yeah|yep)[.!]?$/i, "Yeah"],
  [/^(?:no|nope)[.!]?$/i, "I'm gonna have to say no"],
];

const PAM_SWAPS: Swap[] = [
  [/^(?:hey|hi|hello)[.!]?$/i, "Dunder Mifflin, this is Pam"],
  [/^(?:yes|yeah|yep)[.!]?$/i, "Sure"],
  [/^(?:no|nope)[.!]?$/i, "I don't think so"],
  [/\bthank(?:s| you)\b/gi, "No problem. I'm at reception"],
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

  const joke = id === "michael" && Boolean(hit && hit.id !== "friend");
  const lead =
    id === "michael"
      ? joke
        ? "[eager American office manager, smiling, talking to the whole branch]"
        : "[warm American office manager, sincere, a little too much]"
      : id === "dwight"
        ? "[flat, certain, no smile, correcting a subordinate]"
        : id === "jim"
          ? "[dry, relaxed, slightly amused, as if glancing at a camera]"
          : "[warm, polite receptionist, clear and unhurried]";

  const directed = closer ? directCloser(id, closer, hit) : null;
  if (!directed) return `${lead} ${body}`.trim();
  if (/[?!]$/.test(body)) return `${lead} ${body} [short pause] ${directed}`.trim();
  const bare = body.replace(/[.…]+$/, "");
  return `${lead} ${bare}. [short pause] ${directed}`.trim();
}

function directCloser(id: string, closer: string, hit: TriggerHit | null): string {
  if (id === "michael" && hit && hit.id !== "friend") {
    return "[a short delighted laugh, like he just heard his own joke] <emphasis>That's what she said.</emphasis>";
  }
  if (id === "michael") return `[warm, meaning every word] ${closer}`;
  if (id === "dwight") return `[sharper, as if correcting the record] <emphasis>${closer}</emphasis>`;
  if (id === "jim") return `[deadpan, almost under his breath] ${closer}`;
  return `[gentle, still at the front desk] ${closer}`;
}

function styleMichael(text: string): Styled {
  const hit = pick(text, MICHAEL_RULES);
  return {
    body: applySwaps(text, MICHAEL_SWAPS),
    closer: hit?.line ?? null,
    triggers: hit ? [hit] : [],
  };
}

function styleDwight(text: string): Styled {
  const hit = pick(text, DWIGHT_RULES);
  const closer = hit?.line ?? (text.endsWith("?") ? "Repeat it. As a fact." : null);
  return {
    body: applySwaps(text, DWIGHT_SWAPS),
    closer,
    triggers: hit ? [hit] : [],
  };
}

function styleJim(text: string): Styled {
  const hit = pick(text, JIM_RULES);
  const closer = hit?.line ?? (text.includes("!") ? "Then I look at the camera." : null);
  return {
    body: applySwaps(text, JIM_SWAPS),
    closer,
    triggers: hit ? [hit] : [],
  };
}

function stylePam(text: string): Styled {
  const hit = pick(text, PAM_RULES);
  const closer = hit?.line ?? (text.endsWith("?") ? "Let me check." : null);
  return {
    body: applySwaps(text, PAM_SWAPS),
    closer,
    triggers: hit ? [hit] : [],
  };
}

function stylePlain(text: string): Styled {
  return { body: text, closer: null, triggers: [] };
}

const STYLES: Record<string, (text: string) => Styled> = {
  michael: styleMichael,
  dwight: styleDwight,
  jim: styleJim,
  pam: stylePam,
  plain: stylePlain,
};

/** Drama 3 directions around a finished spoken line. The line itself is not rewritten here. */
export function stageLine(characterId: string, display: string): string {
  const character = getCharacter(characterId);
  const id = character?.id ?? "plain";
  const signature = character?.signature ?? "";
  if (id === "plain" || !display) return display;
  const bare = (value: string) => value.toLowerCase().replace(/[.!?,]+$/g, "").trim();
  const signatureBare = bare(signature);
  const displayBare = bare(display);
  if (signatureBare && displayBare.endsWith(signatureBare)) {
    const cut = displayBare.lastIndexOf(signatureBare);
    const body = display.slice(0, cut).trim().replace(/[.!?,]+$/g, "");
    const joke = signatureBare === "that's what she said";
    const hit: TriggerHit = { id: joke ? "joke" : "closer", label: signature, phrase: signature };
    return script(id, body || display, signature, hit);
  }
  return script(id, display, null, null);
}

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
