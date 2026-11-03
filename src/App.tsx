import { useMemo, useReducer, useState } from "react";
import "./App.css";
import { Consent } from "./components/Consent";
import { DemoBar } from "./components/DemoBar";
import { MainView } from "./components/MainView";
import { HistoryView, SettingsView } from "./components/SecondaryViews";
import { BackIcon, Button, ClockIcon, GearIcon, IconButton, Pill } from "./components/ui";
import { CONNECTOR_READY } from "./lib/config";
import { deriveStatus, initialState, reducer } from "./lib/engine";
import { useLanguage, useNow, usePinned } from "./lib/hooks";
import { dictionaries } from "./lib/i18n";

type View = "main" | "history" | "settings";

function App() {
  const [lang, setLang] = useLanguage();
  const [pinned, togglePin] = usePinned();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [view, setView] = useState<View>("main");
  const [askConsent, setAskConsent] = useState(false);
  const [demo, setDemo] = useState(false);
  const now = useNow();

  const d = dictionaries[lang];
  const status = useMemo(() => deriveStatus(state, now), [state, now]);
  const canStart = CONNECTOR_READY || demo;

  const act = (action: "start" | "pause" | "resume" | "stop") =>
    dispatch({ type: "monitor", action, at: Date.now() });

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
        {view === "main" && <MainView d={d} s={state} status={status} now={now} />}
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
                <p className="mt-2 text-center text-xs text-[var(--muted)]">{d.connectorNotReady}</p>
              )}
            </>
          ) : (
            <div className="flex gap-2">
              {state.monitor === "on" ? (
                <Button onClick={() => act("pause")}>{d.controls.pause}</Button>
              ) : (
                <Button variant="primary" onClick={() => act("resume")}>
                  {d.controls.resume}
                </Button>
              )}
              <Button variant="danger" onClick={() => act("stop")}>
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
              setDemo((v) => !v);
              if (demo) act("stop");
            }}
            className="absolute bottom-1 right-2 text-[10px] text-[var(--muted)] opacity-60 hover:opacity-100"
          >
            {demo ? "demo: on" : "demo: off"}
          </button>
          <DemoBar dispatch={dispatch} active={demo} />
        </>
      )}

      {askConsent && (
        <Consent
          d={d}
          onCancel={() => setAskConsent(false)}
          onAllow={() => {
            setAskConsent(false);
            act("start");
          }}
        />
      )}
    </div>
  );
}

export default App;
