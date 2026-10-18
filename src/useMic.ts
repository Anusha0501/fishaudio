import { useEffect, useRef, useState } from "react";

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function createRecognition(): Recognition | null {
  const host = window as Window & {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  const Ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function useMic(options: {
  onTranscript: (text: string) => void;
  onAutoSend: (text: string) => void;
  autoSend: boolean;
}): {
  supported: boolean;
  hearing: boolean;
  toggle: () => void;
} {
  const [supported, setSupported] = useState(false);
  const [hearing, setHearing] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const finalText = useRef("");
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    setSupported(Boolean(createRecognition()));
    return () => recognition.current?.stop();
  }, []);

  function toggle(): void {
    if (hearing) {
      recognition.current?.stop();
      setHearing(false);
      return;
    }

    const next = createRecognition();
    if (!next) return;
    recognition.current = next;
    finalText.current = "";
    next.continuous = false;
    next.interimResults = true;
    next.lang = "en-US";
    next.onresult = (event) => {
      let finished = "";
      let interim = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const piece = event.results[index];
        if (piece.isFinal) finished += piece[0].transcript;
        else interim += piece[0].transcript;
      }
      finalText.current = finished.trim();
      optionsRef.current.onTranscript((finished || interim).trim());
    };
    next.onerror = () => setHearing(false);
    next.onend = () => {
      setHearing(false);
      const text = finalText.current.trim();
      finalText.current = "";
      if (text && optionsRef.current.autoSend) optionsRef.current.onAutoSend(text);
    };
    try {
      next.start();
      setHearing(true);
    } catch {
      setHearing(false);
    }
  }

  return { supported, hearing, toggle };
}
