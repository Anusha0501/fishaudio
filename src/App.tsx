import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  browserSpeak,
  ensureRoom,
  fetchHealth,
  playBlob,
  publishMessage,
  pullMessages,
  speakLine,
  SpeakError,
  type Health,
} from "./api";
import { getCharacter, listCharacters, PLAIN } from "./engine/characters";
import { formatUsd } from "./engine/credits";
import { DEMO_SCENE } from "./engine/scene";
import { translate } from "./engine/translate";
import type { BoothMessage, SeatId } from "./engine/types";
import { useMic } from "./useMic";

const SPEND_KEY = "booth-spend";
const OPENED_KEY = "booth-opened";

function initialSeat(): SeatId {
  const seat = new URLSearchParams(window.location.search).get("seat");
  return seat === "them" ? "them" : "you";
}

function money(value: number): string {
  return formatUsd(value);
}

export function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [seat, setSeat] = useState<SeatId>(initialSeat);
  const [cast, setCast] = useState<Record<SeatId, string>>({ you: "reggie", them: "vera" });
  const [messages, setMessages] = useState<BoothMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [speakOn, setSpeakOn] = useState(true);
  const [autoSend, setAutoSend] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [spend, setSpend] = useState(() => Number(localStorage.getItem(SPEND_KEY) ?? 0) || 0);
  const [notice, setNotice] = useState<string | null>(null);
  const [onAir, setOnAir] = useState(false);
  const [voiceVia, setVoiceVia] = useState<"fish" | "browser">("browser");
  const [overture, setOverture] = useState(() => sessionStorage.getItem(OPENED_KEY) !== "1");
  const [booting, setBooting] = useState(true);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const air = useRef(0);
  const queue = useRef(Promise.resolve());
  const roomRef = useRef<string | null>(null);
  const seen = useRef(new Set<string>());
  const speakOnRef = useRef(speakOn);
  const healthRef = useRef(health);
  const enqueueRef = useRef<(message: BoothMessage, force?: boolean) => void>(() => {});
  roomRef.current = roomId;
  speakOnRef.current = speakOn;
  healthRef.current = health;

  const character = getCharacter(cast[seat]) ?? PLAIN;
  const preview = useMemo(() => translate(draft, character.id), [draft, character.id]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("room");
    let cancel = false;
    ensureRoom(requested)
      .then((id) => {
        if (cancel) return;
        const url = new URL(window.location.href);
        url.searchParams.set("room", id);
        window.history.replaceState({}, "", url);
        setRoomId(id);
      })
      .catch((error: unknown) => {
        if (!cancel) setNotice(error instanceof Error ? error.message : "The room did not open.");
      })
      .finally(() => {
        if (!cancel) setBooting(false);
      });
    fetchHealth()
      .then((next) => {
        if (cancel) return;
        setHealth(next);
        setVoiceVia(next.configured ? "fish" : "browser");
      })
      .catch(() => {
        if (!cancel) setNotice("The voice line is quiet. Lines will still restyle.");
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const activeRoom = roomId;
    let after = "";
    let primed = false;
    let stop = false;
    let pulling = false;

    async function pull(): Promise<void> {
      if (pulling || stop) return;
      pulling = true;
      try {
        const incoming = await pullMessages(activeRoom, after);
        if (stop) return;
        if (incoming.length === 0) {
          primed = true;
          return;
        }
        after = incoming[incoming.length - 1].id;
        const speakHistory = primed;
        primed = true;
        const fresh = incoming.filter((message) => !seen.current.has(message.id));
        fresh.forEach((message) => seen.current.add(message.id));
        if (fresh.length) {
          setMessages((current) => [
            ...current,
            ...fresh.filter((message) => !current.some((item) => item.id === message.id)),
          ]);
        }
        if (speakHistory) fresh.forEach((message) => enqueueRef.current(message));
      } finally {
        pulling = false;
      }
    }

    void pull();
    const timer = window.setInterval(() => void pull(), 1500);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [roomId]);

  useEffect(() => {
    const node = transcriptRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, preview.display]);

  function retainAir(): void {
    air.current += 1;
    setOnAir(true);
  }

  function releaseAir(): void {
    air.current = Math.max(0, air.current - 1);
    if (air.current === 0) setOnAir(false);
  }

  async function voiceFor(message: BoothMessage): Promise<void> {
    const persona = getCharacter(message.characterId) ?? PLAIN;
    if (healthRef.current?.configured === false) {
      setVoiceVia("browser");
      await browserSpeak(message.display, message.characterId, persona.speed);
      return;
    }
    try {
      const spoken = await speakLine(message.original, message.characterId);
      setSpend((current) => {
        const next = current + (Number.isFinite(spoken.usd) ? spoken.usd : 0);
        localStorage.setItem(SPEND_KEY, String(next));
        return next;
      });
      setVoiceVia("fish");
      await playBlob(spoken.blob);
    } catch (error) {
      const unconfigured = error instanceof SpeakError && error.code === "unconfigured";
      if (!unconfigured) {
        setNotice(error instanceof Error ? error.message : "Fish Audio did not answer.");
      }
      setVoiceVia("browser");
      await browserSpeak(message.display, message.characterId, persona.speed);
    }
  }

  function enqueueVoice(message: BoothMessage, force = false): void {
    if (!force && !speakOnRef.current) return;
    queue.current = queue.current.then(async () => {
      retainAir();
      try {
        await voiceFor(message);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "That line stayed on the page.");
      } finally {
        releaseAir();
      }
    });
  }

  enqueueRef.current = enqueueVoice;

  function deliver(text: string, from: SeatId, characterId: string): void {
    const translation = translate(text, characterId);
    if (!translation.display) return;
    const message: BoothMessage = {
      id: crypto.randomUUID(),
      seat: from,
      characterId,
      original: text.trim(),
      display: translation.display,
      triggers: translation.triggers,
      createdAt: Date.now(),
    };
    seen.current.add(message.id);
    setMessages((current) =>
      current.some((item) => item.id === message.id) ? current : [...current, message],
    );
    setNotice(null);
    const room = roomRef.current;
    if (room) {
      void publishMessage(room, message).catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : "The other chair missed that line.");
      });
    }
    enqueueVoice(message);
  }

  function sendDraft(): void {
    const text = draft.trim();
    if (!text) return;
    deliver(text, seat, cast[seat]);
    setDraft("");
  }

  const mic = useMic({
    onTranscript: setDraft,
    onAutoSend: (text) => {
      setDraft("");
      deliver(text, seat, cast[seat]);
    },
    autoSend,
  });

  function playScene(): void {
    setCast({ you: "reggie", them: "vera" });
    setSeat("you");
    for (const line of DEMO_SCENE) deliver(line.text, line.seat, line.characterId);
  }

  function otherChairLink(): string {
    if (!roomId) return "";
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomId);
    url.searchParams.set("seat", seat === "you" ? "them" : "you");
    return url.toString();
  }

  async function copyLink(): Promise<void> {
    const link = otherChairLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Other chair link copied.");
    } catch {
      setNotice("Select the chair link and copy it.");
    }
  }

  function openBooth(): void {
    sessionStorage.setItem(OPENED_KEY, "1");
    setOverture(false);
  }

  const you = getCharacter(cast.you) ?? PLAIN;
  const them = getCharacter(cast.them) ?? PLAIN;
  const link = otherChairLink();

  return (
    <div className="app">
      {overture ? <Overture onEnter={openBooth} /> : null}
      <header className="topbar">
        <div className="brand">
          <span className={onAir ? "lamp on" : "lamp"} aria-hidden="true" />
          <div>
            <p className="brand-kicker">Fish Audio</p>
            <h1>Booth</h1>
          </div>
        </div>
        <p className="tagline">Say it plain. Send it in character.</p>
        <div className="meters">
          <span className={onAir ? "pill live" : "pill"}>{onAir ? "On air" : "Standby"}</span>
          <span className="pill">{health?.model ?? "checking voice"}</span>
          <span className="pill">Session {money(spend)}</span>
        </div>
      </header>

      <main className="shell">
        <aside className="rail">
          <p className="rail-label">Cast</p>
          <div className="cast">
            {listCharacters().map((persona) => {
              const selected = cast[seat] === persona.id;
              return (
                <button
                  key={persona.id}
                  type="button"
                  className={selected ? "card selected" : "card"}
                  aria-pressed={selected}
                  style={{ "--hue": String(persona.hue) } as CSSProperties}
                  onClick={() => setCast((current) => ({ ...current, [seat]: persona.id }))}
                >
                  <span className="monogram">{persona.monogram}</span>
                  <span>
                    <strong>{persona.name}</strong>
                    <em>{persona.role}</em>
                    <span className="signature">“{persona.signature}”</span>
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className={cast[seat] === "plain" ? "plain selected" : "plain"}
            aria-pressed={cast[seat] === "plain"}
            onClick={() => setCast((current) => ({ ...current, [seat]: "plain" }))}
          >
            Take the character off
          </button>
          <details className="budget">
            <summary>How the $20 is spent</summary>
            <p>
              Restyling is free and happens in the browser. Fish Audio is called only when a line is
              spoken. The default model, s2.1-pro-free, costs $0. The paid s2.1-pro model is $15 per
              million characters, so $20 is about sixteen hours of speech. Repeated lines are cached.
            </p>
          </details>
          <p className="credit">
            Original characters. Public narrator voices. Reggie keeps a famous comic habit without
            borrowing a real person’s voice.
          </p>
        </aside>

        <section className="stage" aria-label="Conversation">
          <div className="nameplates" role="tablist" aria-label="Who is speaking">
            {(["you", "them"] as const).map((id) => {
              const persona = id === "you" ? you : them;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={seat === id}
                  className={seat === id ? "plate active" : "plate"}
                  style={{ "--hue": String(persona.hue) } as CSSProperties}
                  onClick={() => setSeat(id)}
                >
                  <span className="plate-kicker">{id === "you" ? "Your chair" : "Their chair"}</span>
                  <strong>{persona.name}</strong>
                  <em>{persona.role}</em>
                </button>
              );
            })}
            <button type="button" className="scene" onClick={playScene}>
              Play the scene
            </button>
          </div>

          <div className="transcript" ref={transcriptRef}>
            {messages.length === 0 ? (
              <div className="empty">
                <p className="empty-kicker">{booting ? "Opening the booth" : "The booth is quiet"}</p>
                <p>Try “{character.sample}”</p>
              </div>
            ) : (
              messages.map((message) => {
                const persona = getCharacter(message.characterId) ?? PLAIN;
                return (
                  <article
                    key={message.id}
                    className={message.seat === "you" ? "bubble you" : "bubble them"}
                    style={{ "--hue": String(persona.hue) } as CSSProperties}
                  >
                    <header>
                      <span>{persona.name}</span>
                      <button type="button" onClick={() => enqueueVoice(message, true)}>
                        Play
                      </button>
                    </header>
                    <p>{message.display}</p>
                    {message.triggers.map((hit) => (
                      <span key={hit.id} className="chip">
                        Caught “{hit.phrase}”
                      </span>
                    ))}
                    <p className="original">Said: {message.original}</p>
                  </article>
                );
              })
            )}
          </div>

          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              sendDraft();
            }}
          >
            <div className="preview" aria-live="polite">
              <span>They hear</span>
              <p>{preview.display || "Your line will land here, in character, before anyone is charged a sound."}</p>
              {preview.triggers.map((hit) => (
                <em key={hit.id} className="chip">
                  {hit.label}
                </em>
              ))}
            </div>
            <label className="sr-only" htmlFor="line">
              What you mean to say
            </label>
            <textarea
              id="line"
              value={draft}
              maxLength={500}
              rows={3}
              placeholder={`Speaking as ${character.name}. ${character.sample}`}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendDraft();
                }
              }}
            />
            {notice ? <p className="notice">{notice}</p> : null}
            <div className="controls">
              <button
                type="button"
                className={mic.hearing ? "ghost hearing" : "ghost"}
                onClick={mic.toggle}
                disabled={!mic.supported}
                aria-pressed={mic.hearing}
              >
                {mic.supported ? (mic.hearing ? "Listening" : "Talk") : "Mic unavailable"}
              </button>
              <button type="button" className="ghost" onClick={() => setDraft(character.sample)}>
                Try a line
              </button>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={speakOn}
                  onChange={(event) => setSpeakOn(event.target.checked)}
                />
                Speak
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={autoSend}
                  onChange={(event) => setAutoSend(event.target.checked)}
                />
                Send when I pause
              </label>
              <button type="submit" className="send" disabled={!draft.trim()}>
                Send as {character.name}
              </button>
            </div>
            <div className="share">
              <label htmlFor="chair-link">Other chair</label>
              <input id="chair-link" readOnly value={link} />
              <button type="button" onClick={() => void copyLink()}>
                Copy
              </button>
              <span className="via">
                {voiceVia === "fish" ? `Voice · ${character.voiceName}` : "Voice · this browser, until a Fish key is set"}
              </span>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

function Overture({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="overture">
      <div className="overture-card">
        <p className="brand-kicker">A Fish Audio demo</p>
        <h2>
          Say it plain.
          <br />
          They hear the character.
        </h2>
        <p className="lede">
          Booth is a two-chair conversation. You talk the way you talk. The other person hears that
          character’s rhythm, and when your words brush a signature, the line lands out loud.
        </p>
        <ol className="flow">
          <li>
            <strong>Talk</strong>
            <span>Type, or use the mic. The words stay yours.</span>
          </li>
          <li>
            <strong>Restyle</strong>
            <span>Meaning holds. A caught word brings the signature with it.</span>
          </li>
          <li>
            <strong>Speak</strong>
            <span>Fish Audio says it in that voice. The other chair hears the same line.</span>
          </li>
        </ol>
        <div className="score">
          <b>8.2</b>
          <span>
            The comic habit is the hook. The piece worth building is the switch: one thought, another
            mouth, said both as text and as voice.
          </span>
        </div>
        <button type="button" className="enter" onClick={onEnter}>
          Open the booth
        </button>
      </div>
    </div>
  );
}
