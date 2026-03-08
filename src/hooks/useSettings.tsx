import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type FontSize = "normal" | "large" | "xlarge";
export type Language = "pt-BR" | "en-US" | "es-ES";

interface SettingsContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const STORAGE_KEY = "app-settings";

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveSettings(s: Record<string, unknown>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const stored = loadSettings();
  const [fontSize, setFontSizeState] = useState<FontSize>(stored.fontSize || "normal");
  const [highContrast, setHighContrastState] = useState<boolean>(stored.highContrast || false);
  const [reducedMotion, setReducedMotionState] = useState<boolean>(stored.reducedMotion || false);
  const [language, setLanguageState] = useState<Language>(stored.language || "pt-BR");

  // Apply classes to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("font-normal", "font-large", "font-xlarge");
    root.classList.add(`font-${fontSize}`);

    root.classList.toggle("high-contrast", highContrast);
    root.classList.toggle("reduced-motion", reducedMotion);

    root.setAttribute("lang", language);

    saveSettings({ fontSize, highContrast, reducedMotion, language });
  }, [fontSize, highContrast, reducedMotion, language]);

  const setFontSize = (s: FontSize) => setFontSizeState(s);
  const setHighContrast = (v: boolean) => setHighContrastState(v);
  const setReducedMotion = (v: boolean) => setReducedMotionState(v);
  const setLanguage = (l: Language) => setLanguageState(l);

  return (
    <SettingsContext.Provider value={{ fontSize, setFontSize, highContrast, setHighContrast, reducedMotion, setReducedMotion, language, setLanguage }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
