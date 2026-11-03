import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Language } from "./types";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice just won't persist */
  }
}

/** Ticks so time-based status (suspected stuck) re-evaluates without new events. */
export function useNow(intervalMs = 5000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useLanguage(): [Language, (l: Language) => void] {
  const [lang, setLang] = useState<Language>(() => (read("sentiqx.lang") === "hinglish" ? "hinglish" : "en"));
  const set = useCallback((l: Language) => {
    setLang(l);
    write("sentiqx.lang", l);
  }, []);
  return [lang, set];
}

/** Always-on-top is user controlled, defaults to on, and is remembered. */
export function usePinned(): [boolean, () => void] {
  // v2 key: an earlier build saved "off" by default, which would override the new default.
  const [pinned, setPinned] = useState(() => read("sentiqx.pin.v2") !== "0");
  useEffect(() => {
    getCurrentWindow()
      .setAlwaysOnTop(pinned)
      .catch(() => {
        /* window API unavailable (plain browser): ignore */
      });
    write("sentiqx.pin.v2", pinned ? "1" : "0");
  }, [pinned]);
  return [pinned, () => setPinned((p) => !p)];
}
