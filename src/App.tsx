import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import "./App.css";
import { Consent } from "./components/Consent";
import { DemoBar } from "./components/DemoBar";
import { HomeView } from "./components/HomeView";
import { GuardView } from "./components/GuardView";
import { IntelView } from "./components/IntelView";
import { LiveView } from "./components/LiveView";
import { NavBar, type View } from "./components/NavBar";
import { HistoryView, SettingsView } from "./components/SecondaryViews";
import { TitleBar } from "./components/TitleBar";
import { useAwareness } from "./lib/awareness";
import {
  type ConnectorStatus,
  connectorStatus,
  onActivity,
  setPaused,
  setProjectFilter,
  startMonitoring,
  stopMonitoring,
} from "./lib/connector";
import { deriveStatus, initialState, reducer } from "./lib/engine";
import { loadProjectFilter, saveProjectFilter, useLanguage, useNotificationsEnabled, useNow } from "./lib/hooks";
import { dictionaries } from "./lib/i18n";
import { notificationFor, notify } from "./lib/notify";
import type { Status } from "./lib/types";
import { usePinned } from "./lib/windowControls";

const NO_EVENTS_HINT_AFTER_MS = 20_000;

function App() {
  const [lang, setLang] = useLanguage();
  const { pinned, toggle: togglePin, failed: pinFailed } = usePinned();
  const awareness = useAwareness();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [view, setView] = useState<View>("home");
  const [askConsent, setAskConsent] = useState(false);
  const [demo, setDemo] = useState(false);
  const [connector, setConnector] = useState<ConnectorStatus | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState(loadProjectFilter);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [notifications, setNotifications] = useNotificationsEnabled();
  const mainRef = useRef<HTMLElement>(null);
  const now = useNow();

  const d = dictionaries[lang];
  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "hi-Latn";
  }, [lang]);

  const status = useMemo(() => deriveStatus(state, now), [state, now]);
  const canStart = Boolean(connector?.listening) || demo;
  const showNoEventsHint =
    !demo &&
    state.monitor === "on" &&
    state.lastEventAt === null &&
    startedAt !== null &&
    now - startedAt > NO_EVENTS_HINT_AFTER_MS;

  useEffect(() => {
    connectorStatus()
      .then(setConnector)
      .catch(() => setConnector({ listening: false, port: 0, error: null, settingsFile: null }));
  }, []);

  // Meaningful status changes only. Demo data never notifies.
  const prevStatus = useRef<Status | null>(null);
  useEffect(() => {
    const n = notificationFor(prevStatus.current, status, state, d);
    prevStatus.current = status;
    if (n && notifications && !demo) void notify(n.title, n.body);
  }, [status, state, d, notifications, demo]);

  // Real activity from the Rust receiver. The engine itself ignores events unless monitoring is on.
  useEffect(() => onActivity((event) => dispatch({ type: "event", event })), []);

  const act = useCallback(
    (action: "start" | "pause" | "resume" | "stop") =>
      dispatch({ type: "monitor", action, at: Date.now() }),
    [],
  );

  const begin = async () => {
    setAskConsent(false);
    setError(null);
    if (demo) {
      act("start");
      return;
    }
    // Turn the engine on first so the very first event cannot be missed.
    act("start");
    try {
      await startMonitoring();
      if (filter) await setProjectFilter(filter);
      setStartedAt(Date.now());
    } catch (e) {
      act("stop");
      await stopMonitoring().catch(() => undefined);
      setError(d.startFailed(String(e)));
    }
  };

  const control = async (action: "pause" | "resume" | "stop") => {
    setError(null);
    try {
      if (!demo) {
        if (action === "stop") await stopMonitoring();
        else await setPaused(action === "pause");
      }
    } catch (e) {
      setError(d.startFailed(String(e)));
      return;
    }
    act(action);
    if (action === "resume") setStartedAt(Date.now());
    if (action === "stop") setStartedAt(null);
  };

  const applyFilter = async (folder: string) => {
    const value = folder.trim();
    try {
      await setProjectFilter(value || null);
      setFilter(value);
      saveProjectFilter(value);
      setFilterError(null);
    } catch (e) {
      setFilterError(String(e));
    }
  };

  const navigate = (v: View, anchor?: string) => {
    setView(v);
    // Wait for the tab to become visible before scrolling.
    requestAnimationFrame(() => {
      if (anchor) document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
      else mainRef.current?.scrollTo(0, 0);
    });
  };

  const connectorNote = canStart
    ? null
    : `${d.connectorNotReady}${connector?.error ? ` (${connector.error})` : ""}`;

  return (
    <div className="frame relative flex h-full flex-col overflow-hidden rounded-[12px]">
      <TitleBar d={d} pinned={pinned} onTogglePin={togglePin} pinFailed={pinFailed} />

      {demo && (
        <p className="mx-3 mt-2 rounded-lg border border-[var(--s-waiting)] px-3 py-1.5 text-center text-[11px] font-medium tracking-wide text-[var(--s-waiting)]">
          {d.demoBanner}
        </p>
      )}

      {/* All views stay mounted so a draft or a loaded preview survives switching tabs. */}
      <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div hidden={view !== "home"}>
          <HomeView
            d={d}
            s={state}
            status={status}
            now={now}
            prefs={awareness.prefs}
            app={awareness.app}
            recent={awareness.recent}
            awarenessFailed={awareness.failed}
            onAwareness={awareness.update}
            onNavigate={navigate}
            onConnect={() => setAskConsent(true)}
          />
        </div>
        <div hidden={view !== "live"}>
          <LiveView
            d={d}
            s={state}
            status={status}
            now={now}
            hint={showNoEventsHint ? d.noEventsHint : null}
            error={error}
            canStart={canStart}
            connectorNote={connectorNote}
            onStart={() => setAskConsent(true)}
            onPause={() => void control("pause")}
            onResume={() => void control("resume")}
            onStop={() => void control("stop")}
          />
        </div>
        <div hidden={view !== "intel"}>
          <IntelView d={d} />
        </div>
        <div hidden={view !== "guard"}>
          <GuardView d={d} app={awareness.app} />
        </div>
        <div hidden={view !== "history"}>
          <HistoryView d={d} active={view === "history"} version={state.feed.length} />
        </div>
        <div hidden={view !== "settings"}>
          <SettingsView
            d={d}
            lang={lang}
            setLang={setLang}
            pinned={pinned}
            togglePin={togglePin}
            awareness={awareness.prefs}
            onAwareness={awareness.update}
            filter={filter}
            filterError={filterError}
            onFilter={(f) => void applyFilter(f)}
            notifications={notifications}
            onNotifications={setNotifications}
          />
        </div>
      </main>

      {import.meta.env.DEV && view === "live" && (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              if (demo) void control("stop");
              setDemo((v) => !v);
            }}
            className="absolute -top-5 right-3 font-mono text-[10px] text-[var(--faint)] hover:text-[var(--text)]"
          >
            {demo ? "demo: on" : "demo: off"}
          </button>
          <DemoBar dispatch={dispatch} active={demo} />
        </div>
      )}

      <NavBar d={d} view={view} onChange={navigate} />

      {askConsent && (
        <Consent d={d} onCancel={() => setAskConsent(false)} onAllow={() => void begin()} />
      )}
    </div>
  );
}

export default App;
