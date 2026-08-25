import React, { createContext, useContext, useState, useCallback } from "react";

// The page context Ygri Copilot uses to resolve "this project" without the
// user having to name it. It's a hint for conversational resolution only —
// every id it carries is still validated server-side on every tool call
// (Copilot Blueprint §43/§I). Scoped to the authenticated Layout only.
const Ctx = createContext({ pageContext: {}, setPageContext: () => {} });

export function CopilotPageProvider({ children }) {
  const [pageContext, setPageContextState] = useState({});
  const setPageContext = useCallback((next) => setPageContextState(next || {}), []);
  return <Ctx.Provider value={{ pageContext, setPageContext }}>{children}</Ctx.Provider>;
}

export function useCopilotPageContext() {
  return useContext(Ctx);
}
