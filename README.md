# Booth

Say it plain. Send it in character.

Booth is a two-chair conversation. You talk the way you talk. The other person hears a character: the same meaning, that character’s rhythm, and a signature line when your words brush the phrase that calls it. Fish Audio speaks the result.

**Idea: 8.2 / 10.** The comic habit is an immediate hook. The piece worth keeping is the switch itself — one thought, another mouth, as text and as voice, in both directions. Celebrity impersonation would make it smaller and legally shaky, so the cast is original and the voices are public Fish Audio narrators. Reggie Dunn, the regional manager, keeps the famous “that’s what she said” habit without borrowing anyone’s real voice.

## What a line does

```
You, in your chair                         Them, in the other chair
type or talk
        │
        ▼
Web Speech  ──transcript──►  the draft you can still edit
        │
        ▼
Character engine, in the browser, $0
  keep the meaning
  season the rhythm
  if a watched word or phrase is there, land one signature
        │
        ├── preview: "They hear" updates before you send
        ▼
Transcript for both chairs
  the character line, the original tucked underneath
        │
        ▼
POST /api/speak          only if Speak is on
  server restyles again and calls Fish Audio
  identical lines are cached, so a replay is free
        │
        ▼
mp3 in that character's public voice
the other chair hears it too
```

Open the other chair with the link in the composer. It is the same room, the other seat. Lines sync about once a second. The first play calls Fish Audio; the second chair hits the cache.

## The cast

| Character | Habit | Public voice |
| --- | --- | --- |
| Reggie Dunn, regional manager | “That’s what she said.” when a plain word can hold the joke | [Energetic Male](https://fish.audio/m/9a9cf47702da476aa4629e2506d4a857) |
| Vera Vale, night detective | “The city keeps the receipt.” | [British female narrator](https://fish.audio/m/89f41ea230034706881f85a8227d6ab9) |
| Captain Ivo, ferry captain | “Steady. The dock will still be there.” | [Deep British Narrator](https://fish.audio/m/1ca5d32c6b9f432db87be6fdbca86bfd) |
| Lumen Park, overnight host | A dedication, or “And that is the record.” | [Energetic Female Announcer](https://fish.audio/m/9cf30df1a9b34666983695dc6fc338d2) |

“Take the character off” sends the line unchanged, still spoken if you want it heard.

Try, as Reggie: `This quarterly report is really hard.`

## The $20

Restyling never calls an API. Speech uses `s2.1-pro-free` by default, which is $0. A paid switch is one line in `.env`:

```bash
FISH_MODEL=s2.1-pro
```

`s2.1-pro` is $15 per million UTF-8 bytes. $20 covers about 1.33 million bytes, roughly sixteen hours of speech. The booth also:

- shows the rewrite before any audio is requested
- speaks only when Speak is on
- caches each performance on disk, and collapses two chairs asking for the same line into one Fish call
- uses the browser’s speech recognition for the mic, so transcription does not spend the balance

The header shows what this browser session has sent to a paid model.

## Run it

```bash
cp .env.example .env
# put a Fish Audio key in FISH_API_KEY if you want the real voices
npm install
npm test
npm run dev
```

Open http://127.0.0.1:5173 . Without a key, the rewrite still works and speech falls back to the browser voice.

`npm run build && npm start` serves the production build.

## Layout

- `src/engine` — characters, the rewrite, and the credit math. Tested, shared by the page and the server.
- `src/App.tsx` — the booth: two chairs, preview, mic, transcript.
- `server` — Fish Audio proxy, audio cache, and the room the other chair joins. The API key stays here.
