import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";

const PIN_KEY = "sentiqx.pinOnTop";

function loadPinned(): boolean {
  try {
    const saved = localStorage.getItem(PIN_KEY);
    return saved === null ? true : saved === "1"; // default: pinned, user can unpin
  } catch {
    return true;
  }
}

// Placeholder shell. No monitoring yet: nothing here is real activity data.
function App() {
  const [pinned, setPinned] = useState<boolean>(loadPinned);

  // Apply the saved choice to the real window, and remember it.
  useEffect(() => {
    getCurrentWindow()
      .setAlwaysOnTop(pinned)
      .catch(() => {
        /* window API unavailable (e.g. plain browser): ignore */
      });
    try {
      localStorage.setItem(PIN_KEY, pinned ? "1" : "0");
    } catch {
      /* storage unavailable: preference just won't persist */
    }
  }, [pinned]);

  return (
    <main className="flex h-full flex-col gap-3 p-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-wide">SENTIQX</h1>
          <p className="text-xs text-[var(--muted)]">
            Your AI works. SENTIQX understands.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPinned((p) => !p)}
            aria-pressed={pinned}
            title={pinned ? "Unpin: stop staying on top" : "Pin: stay on top of other windows"}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              pinned
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {pinned ? "Pinned on top" : "Pin on top"}
          </button>
          <span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--muted)]">
            Not monitoring
          </span>
        </div>
      </header>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
          Status
        </p>
        <p className="mt-1 text-sm">No session connected yet.</p>
      </section>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
          Live preview
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">Preview unavailable.</p>
      </section>
    </main>
  );
}

export default App;
