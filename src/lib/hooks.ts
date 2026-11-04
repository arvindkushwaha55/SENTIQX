import { useCallback, useEffect, useState } from "react";
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

/** Optional folder that monitoring is limited to. Empty means every Claude session. */
export const loadProjectFilter = (): string => read("sentiqx.projectFilter") ?? "";
export const saveProjectFilter = (p: string) => write("sentiqx.projectFilter", p);

export function useNotificationsEnabled(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(() => read("sentiqx.notifications") !== "0");
  const set = useCallback((v: boolean) => {
    setOn(v);
    write("sentiqx.notifications", v ? "1" : "0");
  }, []);
  return [on, set];
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
