import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import "./App.css";
import { Consent } from "./components/Consent";
import { DemoBar } from "./components/DemoBar";
import { MainView } from "./components/MainView";
import { HistoryView, SettingsView } from "./components/SecondaryViews";
import { BackIcon, Button, ClockIcon, GearIcon, IconButton, Pill } from "./components/ui";
import {
  type ConnectorStatus,
  connectorStatus,
  onActivity,
  pickProjectFolder,
  setPaused,
  startMonitoring,
  stopMonitoring,
} from "./lib/connector";
import { deriveStatus, initialState, reducer } from "./lib/engine";
import { loadLastProject, saveLastProject, useLanguage, useNow, usePinned } from "./lib/hooks";
import { dictionaries } from "./lib/i18n";

type View = "main" | "history" | "settings";
const NO_EVENTS_HINT_AFTER_MS = 20_000;

function App() {
  const [lang, setLang] = useLanguage();
  const [pinned, togglePin] = usePinned();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [view, setView] = useState<View>("main");
  const [askConsent, setAskConsent] = useState(false);
  const [demo, setDemo] = useState(false);
  const [connector, setConnector] = useState<ConnectorStatus | null>(null);
  const [project, setProject] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();

  const d = dictionaries[lang];
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
      .catch(() => setConnector({ listening: false, port: 0, error: null }));
  }, []);

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
    try {
      const folder = await pickProjectFolder(d.pickFolderTitle, loadLastProject() ?? undefined);
      if (!folder) return;
      // Turn the engine on first so the very first event cannot be missed.
      act("start");
      try {
        await startMonitoring(folder);
      } catch (e) {
        act("stop");
        throw e;
      }
      saveLastProject(folder);
      setProject(folder);
      setStartedAt(Date.now());
    } catch (e) {
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
    if (action === "stop") {
      setProject(null);
      setStartedAt(null);
    }
  };

  return (
    <div className="relative flex h-full flex-col">
      <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
        {view === "main" ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[13px] font-bold text-[#0a0c11]"
              style={{ background: "linear-gradient(135deg, #8b9bff, #4fd1c5)" }}
              aria-hidden="true"
            >
              S
            </div>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold leading-tight tracking-wide">SENTIQX</h1>
              <p className="truncate text-[11px] leading-tight text-[var(--muted)]">{d.tagline}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <IconButton label={d.nav.back} onClick={() => setView("main")}>
              <BackIcon />
            </IconButton>
            <h1 className="text-[15px] font-semibold">
              {view === "settings" ? d.settings.title : d.history.title}
            </h1>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-1">
          {view === "main" && (
            <>
              <Pill onClick={togglePin} active={pinned} title={pinned ? d.pin.onHint : d.pin.offHint}>
                {pinned ? d.pin.on : d.pin.off}
              </Pill>
              <IconButton label={d.nav.history} onClick={() => setView("history")}>
                <ClockIcon />
              </IconButton>
              <IconButton label={d.nav.settings} onClick={() => setView("settings")}>
                <GearIcon />
              </IconButton>
            </>
          )}
        </div>
      </header>

      {demo && (
        <p className="mx-4 mb-2 rounded-lg border border-[var(--s-waiting)] px-3 py-1.5 text-center text-[11px] font-medium tracking-wide text-[var(--s-waiting)]">
          {d.demoBanner}
        </p>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        {view === "main" && (
          <MainView
            d={d}
            s={state}
            status={status}
            now={now}
            project={demo ? null : project}
            hint={showNoEventsHint ? d.noEventsHint : null}
            error={error}
          />
        )}
        {view === "settings" && (
          <SettingsView d={d} lang={lang} setLang={setLang} pinned={pinned} togglePin={togglePin} />
        )}
        {view === "history" && <HistoryView d={d} />}
      </main>

      {view === "main" && (
        <footer className="border-t border-[var(--line)] bg-[var(--bg)] px-4 py-3">
          {state.monitor === "off" ? (
            <>
              <Button variant="primary" disabled={!canStart} onClick={() => setAskConsent(true)}>
                {d.controls.start}
              </Button>
              {!canStart && (
                <p className="mt-2 text-center text-xs text-[var(--muted)]">
                  {d.connectorNotReady}
                  {connector?.error ? ` (${connector.error})` : ""}
                </p>
              )}
            </>
          ) : (
            <div className="flex gap-2">
              {state.monitor === "on" ? (
                <Button onClick={() => void control("pause")}>{d.controls.pause}</Button>
              ) : (
                <Button variant="primary" onClick={() => void control("resume")}>
                  {d.controls.resume}
                </Button>
              )}
              <Button variant="danger" onClick={() => void control("stop")}>
                {d.controls.stop}
              </Button>
            </div>
          )}
        </footer>
      )}

      {import.meta.env.DEV && view === "main" && (
        <>
          <button
            type="button"
            onClick={() => {
              if (demo) void control("stop");
              setDemo((v) => !v);
            }}
            className="absolute bottom-1 right-2 text-[10px] text-[var(--muted)] opacity-60 hover:opacity-100"
          >
            {demo ? "demo: on" : "demo: off"}
          </button>
          <DemoBar dispatch={dispatch} active={demo} />
        </>
      )}

      {askConsent && (
        <Consent d={d} onCancel={() => setAskConsent(false)} onAllow={() => void begin()} />
      )}
    </div>
  );
}

export default App;
