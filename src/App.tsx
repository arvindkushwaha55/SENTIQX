import "./App.css";

// Placeholder shell. No monitoring yet: nothing here is real activity data.
function App() {
  return (
    <main className="flex h-full flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-wide">SENTIQX</h1>
          <p className="text-xs text-[var(--muted)]">
            Your AI works. SENTIQX understands.
          </p>
        </div>
        <span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--muted)]">
          Not monitoring
        </span>
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
