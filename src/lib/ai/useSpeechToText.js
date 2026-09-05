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
//
// `continuous: true` keeps listening across natural pauses in speech
// instead of stopping after the first one — needed for narrating something
// longer (a meeting recap, a multi-sentence comment) rather than a single
// short utterance. In that mode `e.results` accumulates for the whole
// session, so only the segments from `e.resultIndex` onward (and only the
// ones marked `isFinal`) are new since the last event — without that,
// every pause would re-emit everything said so far, duplicating text for
// a caller that appends each result.
export function useSpeechToText(onResult, { continuous = false } = {}) {
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
    recognition.continuous = continuous;
    recognition.onresult = (e) => {
      let transcript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) transcript += e.results[i][0].transcript + " ";
      }
      transcript = transcript.trim();
      if (transcript) onResult(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [SpeechRecognitionCtor, listening, lang, onResult, continuous]);

  return { supported, listening, lang, setLang, start, stop };
}
