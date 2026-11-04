import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ago } from "../lib/format";
import type { Dict } from "../lib/i18n";
import { parseLocalUrl } from "../lib/preview";
import type { Summary } from "../lib/summary";
import type { ErrorView } from "../lib/summary";
import type { FeedItem, SessionState } from "../lib/types";
import { AlertIcon, ExternalIcon, GlobeIcon, RefreshIcon } from "./icons";
import { Button, Card, Label } from "./ui";

export function ActivityCard({ d, s, summary }: { d: Dict; s: SessionState; summary: Summary }) {
  const tools = Object.entries(s.completed);
  return (
    <Card>
      <div className="space-y-3.5">
        <div>
          <Label>{d.labels.done}</Label>
          <p className="mt-1 text-[13px] leading-snug">{summary.done}</p>
          {tools.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tools.map(([tool, n]) => (
                <span key={tool} className="chip" style={{ color: "var(--s-done)" }}>
                  {tool} ×{n}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-[var(--line)] pt-3.5">
          <Label>{d.labels.next}</Label>
          <p className="mt-1 text-[13px] leading-snug">{summary.next}</p>
        </div>
      </div>
    </Card>
  );
}

const feedColor = (f: FeedItem) => {
  if (f.kind === "tool") return f.interrupted ? "var(--muted)" : f.ok ? "var(--s-done)" : "var(--s-error)";
  return { prompt: "var(--cyan)", wait: "var(--s-waiting)", stop: "var(--s-done)", error: "var(--s-error)", end: "var(--muted)" }[f.kind];
};

function feedText(d: Dict, f: FeedItem): string {
  const tool = f.tool ?? "?";
  switch (f.kind) {
    case "prompt":
      return d.feed.prompt;
    case "tool":
      return f.interrupted ? d.feed.toolCancelled(tool) : f.ok ? d.feed.toolOk(tool) : d.feed.toolFailed(tool);
    case "wait":
      return d.feed.wait(tool);
    case "stop":
      return d.feed.stop;
    case "error":
      return d.feed.error(f.errorType ?? "unknown");
    case "end":
      return d.feed.end;
  }
}

export function FeedCard({ d, s, now }: { d: Dict; s: SessionState; now: number }) {
  const items = [...s.feed].reverse();
  return (
    <Card>
      <Label>{d.feed.title}</Label>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--muted)]">{d.feed.empty}</p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {items.map((f, i) => (
            <li key={`${f.at}-${i}`} className="flex items-center gap-2.5 text-[12.5px]">
              <span className="dot" style={{ color: feedColor(f) }} />
              <span className="min-w-0 flex-1 truncate">{feedText(d, f)}</span>
              <span className="shrink-0 font-mono text-[10.5px] text-[var(--faint)]">{ago(now - f.at, d.time)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ErrorCard({ d, view }: { d: Dict; view: ErrorView }) {
  const rows: [string, string][] = [
    [d.error.what, view.what],
    [d.error.meaning, view.meaning],
    [d.error.fixing, view.fixing],
    [d.error.action, view.action],
  ];
  return (
    <Card accent="var(--s-error)">
      <div className="flex items-center gap-2 text-[var(--s-error)]">
        <AlertIcon size={15} />
        <Label className="!text-[var(--s-error)]">{d.error.title}</Label>
      </div>
      <dl className="mt-3 space-y-2.5">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="label">{k}</dt>
            <dd className="mt-0.5 text-[13px] leading-snug">{v}</dd>
          </div>
        ))}
      </dl>
      {view.details && (
        <details className="mt-3 text-xs text-[var(--muted)]">
          <summary className="cursor-pointer select-none hover:text-[var(--text)]">{d.error.details}</summary>
          <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--bg0)] p-2 font-mono text-[11px] leading-relaxed">
            {view.details}
          </pre>
        </details>
      )}
    </Card>
  );
}

const LAST_URL = "sentiqx.previewUrl";
const readLast = () => {
  try {
    return localStorage.getItem(LAST_URL) ?? "";
  } catch {
    return "";
  }
};

/**
 * Shows a real, running local page in an iframe. The page is never generated or mocked:
 * if nothing is loaded, or the page cannot be embedded, the card says so. The iframe is
 * isolated, so a broken preview can never affect monitoring.
 */
export function PreviewCard({ d }: { d: Dict }) {
  const [input, setInput] = useState(readLast);
  const [url, setUrl] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  const [version, setVersion] = useState(0);

  const load = () => {
    const parsed = parseLocalUrl(input);
    setBad(parsed === null);
    setUrl(parsed);
    if (parsed) {
      try {
        localStorage.setItem(LAST_URL, input);
      } catch {
        /* not persisted */
      }
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <Label>{d.preview.title}</Label>
        {url && (
          <div className="flex gap-1">
            <button type="button" className="winbtn" onClick={() => setVersion((v) => v + 1)} title={d.preview.reload} aria-label={d.preview.reload}>
              <RefreshIcon size={14} />
            </button>
            <button type="button" className="winbtn" onClick={() => void openUrl(url).catch(() => undefined)} title={d.preview.open} aria-label={d.preview.open}>
              <ExternalIcon size={14} />
            </button>
          </div>
        )}
      </div>

      {url ? (
        <>
          <iframe
            key={`${url}-${version}`}
            src={url}
            title={d.preview.title}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
            className="mt-2.5 h-56 w-full rounded-xl border border-[var(--line)] bg-white"
          />
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">{d.preview.embedNote}</p>
          <Button variant="subtle" className="mt-2 w-full" onClick={() => setUrl(null)}>
            {d.preview.clear}
          </Button>
        </>
      ) : (
        <div className="mt-2.5">
          <div className="grid place-items-center rounded-xl border border-dashed border-[var(--line-strong)] px-4 py-5 text-center">
            <GlobeIcon size={22} className="mb-2 text-[var(--faint)]" />
            <p className="text-[13px]">{d.preview.unavailable}</p>
            <p className="mt-1 max-w-[290px] text-xs leading-relaxed text-[var(--muted)]">{d.preview.hint}</p>
          </div>
          <form
            className="mt-2.5 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
          >
            <input
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setBad(false);
              }}
              placeholder={d.preview.urlPlaceholder}
              spellCheck={false}
              aria-label={d.preview.title}
              className="min-w-0 flex-1 rounded-xl border border-[var(--line-strong)] bg-[var(--bg0)] px-3 py-2 font-mono text-[12px] text-[var(--text)] placeholder:text-[var(--faint)]"
            />
            <Button variant="ghost" onClick={load} disabled={!input.trim()}>
              {d.preview.load}
            </Button>
          </form>
          {bad && (
            <p className="mt-2 text-xs text-[var(--s-error)]" role="alert">
              {d.preview.invalid}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
