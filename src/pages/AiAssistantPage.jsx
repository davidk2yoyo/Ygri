import React, { useState, useRef, useCallback, useEffect } from "react";
import { FullPageChat } from "flowise-embed-react";
import logoShort from "../assets/images/logo/logo-short.png";

const MIN_WIDTH = 320;
const MIN_HEIGHT = 400;
const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 600;

export default function YgriAiChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [isResizing, setIsResizing] = useState(false);
  const startPos = useRef(null);
  const startSize = useRef(null);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    startPos.current = { x: e.clientX, y: e.clientY };
    startSize.current = { ...size };
  }, [size]);

  const handleResizeMove = useCallback((e) => {
    if (!isResizing || isExpanded) return;
    const dx = startPos.current.x - e.clientX;
    const dy = startPos.current.y - e.clientY;
    setSize({
      width: Math.max(MIN_WIDTH, startSize.current.width + dx),
      height: Math.max(MIN_HEIGHT, startSize.current.height + dy),
    });
  }, [isResizing, isExpanded]);

  const handleResizeEnd = useCallback(() => setIsResizing(false), []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", handleResizeMove);
      window.addEventListener("mouseup", handleResizeEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeEnd);
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  const panelWidth = isExpanded ? "90vw" : size.width;
  const panelHeight = isExpanded ? "90vh" : size.height;

  return (
    <>
      {/* Floating open button — only when closed */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-2xl text-white font-semibold text-sm transition-all hover:scale-105 active:scale-95"
          style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)" }}
        >
          <img src={logoShort} alt="Ygri" className="w-6 h-6 rounded-full bg-white p-0.5 object-contain" />
          <span>Ygri AI</span>
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed z-50 flex flex-col rounded-2xl shadow-2xl border border-gray-200 overflow-hidden min-h-0"
          style={{
            bottom: isExpanded ? "5vh" : 24,
            right: isExpanded ? "5vw" : 24,
            width: panelWidth,
            height: panelHeight,
            transition: isResizing ? "none" : "width 0.2s, height 0.2s",
            background: "#fff",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white flex-shrink-0 select-none"
            style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)" }}
          >
            <div className="flex items-center gap-2">
              <img src={logoShort} alt="Ygri" className="w-7 h-7 rounded-full bg-white p-0.5 object-contain" />
              <div>
                <p className="font-semibold text-sm leading-tight">Ygri AI Assistant</p>
                <p className="text-xs text-blue-200 leading-tight">Pregunta sobre proyectos, clientes y más</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Expand / Shrink toggle */}
              <button
                onClick={() => setIsExpanded((v) => !v)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                title={isExpanded ? "Reducir" : "Expandir"}
              >
                {isExpanded ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0h5m-5 0v5M15 9l5-5m0 0h-5m5 0v5M9 15l-5 5m0 0h5m-5 0v-5M15 15l5 5m0 0h-5m5 0v-5" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                  </svg>
                )}
              </button>
              {/* Close */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                title="Cerrar"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Inline full chat — fills remaining space */}
          <div className="flex-1 overflow-hidden" style={{ minHeight: 0, height: "100%", display: "flex", flexDirection: "column" }}>
            <FullPageChat
              style={{ flex: 1, height: "100%", width: "100%", minHeight: 0 }}
              chatflowid="6f481b22-c059-47a7-a421-3ca1c81d6ed3"
              apiHost="https://flowise.heruba.guru"
              theme={{
                chatWindow: {
                  showTitle: false,
                  showAgentMessages: true,
                  welcomeMessage: "Hola! Soy tu asistente Ygri. Pregúntame sobre proyectos, clientes o cotizaciones.",
                  backgroundColor: "#ffffff",
                  fontSize: 14,
                  poweredByTextColor: "#aaa",
                  botMessage: {
                    backgroundColor: "#f0f4ff",
                    textColor: "#1e293b",
                  },
                  userMessage: {
                    backgroundColor: "#2563eb",
                    textColor: "#ffffff",
                  },
                  textInput: {
                    placeholder: "Pregunta sobre proyectos, clientes...",
                    backgroundColor: "#ffffff",
                    textColor: "#1e293b",
                    sendButtonColor: "#2563eb",
                  },
                },
              }}
            />
          </div>

          {/* Resize handle — top-left corner */}
          {!isExpanded && (
            <div
              onMouseDown={handleResizeStart}
              className="absolute top-0 left-0 w-5 h-5 z-10 cursor-nw-resize flex items-center justify-center"
              style={{ touchAction: "none" }}
              title="Arrastra para redimensionar"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 9L9 1M1 5L5 1M5 9L9 5" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          )}
        </div>
      )}
    </>
  );
}
