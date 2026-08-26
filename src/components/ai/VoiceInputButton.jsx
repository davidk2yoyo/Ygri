import React from "react";
import { useSpeechToText } from "../../lib/ai/useSpeechToText";

// Mic button + ES/EN toggle, feeding transcribed speech into onTranscript.
// Renders nothing if the browser doesn't support SpeechRecognition (Firefox/Safari).
export default function VoiceInputButton({ onTranscript, size = "w-9 h-9" }) {
  const { supported, listening, lang, setLang, start, stop } = useSpeechToText(onTranscript);

  if (!supported) return null;

  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={() => setLang(lang.startsWith("es") ? "en-US" : "es-CO")}
        disabled={listening}
        title="Speech recognition language"
        className="px-1.5 h-9 rounded-lg text-[11px] font-bold text-bgray-400 hover:text-primary hover:bg-bgray-100 dark:hover:bg-darkblack-500 transition disabled:opacity-40"
      >
        {lang.startsWith("es") ? "ES" : "EN"}
      </button>
      <button
        type="button"
        onClick={() => (listening ? stop() : start())}
        title={listening ? "Stop listening" : "Speak instead of typing"}
        className={`shrink-0 flex items-center justify-center ${size} rounded-xl transition ${
          listening ? "bg-red-500 text-white animate-pulse" : "bg-bgray-100 dark:bg-darkblack-500 text-bgray-500 dark:text-bgray-300 hover:text-primary"
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
      </button>
    </div>
  );
}
