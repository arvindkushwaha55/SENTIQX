import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import type { ActiveApp } from "./appContext";

export interface AwarenessPrefs {
  asked: boolean;
  enabled: boolean;
  showTitles: boolean;
}

export interface RecentApp {
  name: string;
  category: ActiveApp["category"];
  at: number;
}

const MAX_RECENT = 5;

/** Adds an app switch to the list. A title change inside the same app is not a switch. */
export function pushRecent(list: RecentApp[], app: ActiveApp, at: number): RecentApp[] {
  if (list[0]?.name === app.name) return list;
  return [{ name: app.name, category: app.category, at }, ...list].slice(0, MAX_RECENT);
}

/** Permission-gated app detection. `prefs` is null until the saved choice has been read. */
export function useAwareness() {
  const [prefs, setPrefs] = useState<AwarenessPrefs | null>(null);
  const [app, setApp] = useState<ActiveApp | null>(null);
  const [recent, setRecent] = useState<RecentApp[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    invoke<AwarenessPrefs>("awareness_prefs")
      .then(setPrefs)
      .catch(() => setFailed(true));
    invoke<ActiveApp | null>("active_app")
      .then((a) => {
        if (a) {
          setApp(a);
          setRecent((r) => pushRecent(r, a, Date.now()));
        }
      })
      .catch(() => undefined);

    let stop: (() => void) | null = null;
    let cancelled = false;
    listen<ActiveApp | null>("active-app", (msg) => {
      const a = msg.payload;
      setApp(a);
      if (a) setRecent((r) => pushRecent(r, a, Date.now()));
    })
      .then((un) => {
        if (cancelled) un();
        else stop = un;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  const update = useCallback((enabled: boolean, showTitles: boolean) => {
    invoke<void>("set_awareness", { enabled, showTitles })
      .then(() => {
        setPrefs({ asked: true, enabled, showTitles: enabled && showTitles });
        setFailed(false);
        if (!enabled) {
          setApp(null);
          setRecent([]);
        }
      })
      .catch(() => setFailed(true));
  }, []);

  return { prefs, app, recent, failed, update };
}
