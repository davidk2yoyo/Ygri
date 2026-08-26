import { useState, useRef, useCallback } from "react";

const LANG_STORAGE_KEY = "ygri_copilot_speech_lang";
const DEFAULT_LANG = "es-CO";

function readStoredLang() {
  try {
    return localStorage.getItem(LANG_STORAGE_KEY) || DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

// Thin wrapper around the browser's native SpeechRecognition (Chrome/Edge —
// not available in Firefox/Safari, hence `supported`). No backend involved;
// transcription happens entirely in the browser.
export function useSpeechToText(onResult) {
  const [listening, setListening] = useState(false);
  const [lang, setLangState] = useState(readStoredLang);
  const recognitionRef = useRef(null);

  const SpeechRecognitionCtor = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const supported = !!SpeechRecognitionCtor;

  const setLang = useCallback((next) => {
    setLangState(next);
    try { localStorage.setItem(LANG_STORAGE_KEY, next); } catch { /* private browsing, etc. */ }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognitionCtor || listening) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map((r) => r[0].transcript).join(" ").trim();
      if (transcript) onResult(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [SpeechRecognitionCtor, listening, lang, onResult]);

  return { supported, listening, lang, setLang, start, stop };
}
