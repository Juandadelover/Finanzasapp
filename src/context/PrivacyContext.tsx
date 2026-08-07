"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "finanzas:privacy-hidden";
export const MASKED_AMOUNT = "••••••";

interface PrivacyContextValue {
  hidden: boolean;
  toggleHidden: () => void;
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // Preference lives in localStorage, only readable after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const toggleHidden = useCallback(() => {
    setHidden((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  return <PrivacyContext.Provider value={{ hidden, toggleHidden }}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error("usePrivacy debe usarse dentro de PrivacyProvider");
  return ctx;
}
