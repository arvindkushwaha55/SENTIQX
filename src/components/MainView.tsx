import { buildErrorView, buildSummary } from "../lib/summary";
import type { Dict } from "../lib/i18n";
import type { SessionState, Status } from "../lib/types";
import { Card, Label } from "./ui";

interface Props {
  d: Dict;
  s: SessionState;
  status: Status | null;
  now: number;
}

const COLOR: Record<Status, string> = {
  working: "var(--s-working)",
  waiting: "var(--s-waiting)",
  stuck: "var(--s-stuck)",
  error: "var(--s-error)",
  done: "var(--s-done)",
};

export function MainView({ d, s, status, now }: Props) {
  const summary = buildSummary(s, status, now, d);
  const err = buildErrorView(s, d);
  const color = status ? COLOR[status] : "var(--muted)";

  return (
    <div className="space-y-3">
      <Card accent={color}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5" style={{ color }}>
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full bg-current ${
                status === "working" || status === "waiting" ? "pulse" : ""
              }`}
              aria-hidden="true"
            />
            <span
              className="truncate text-[15px] font-semibold tracking-wide"
              role="status"
              aria-live="polite"
            >
              {status ? d.status[status] : d.statusNone}
            </span>
          </div>
          <MonitorBadge d={d} s={s} />
        </div>
        {s.monitor === "paused" && (
          <p className="mt-2 text-xs text-[var(--muted)]">{d.pausedNote}</p>
        )}
      </Card>

      <Card>
        <dl className="space-y-3">
          <Row label={d.labels.now} text={summary.now} />
          <Row label={d.labels.done} text={summary.done} />
          <Row label={d.labels.next} text={summary.next} />
        </dl>
      </Card>

      {err && (
        <Card accent="var(--s-error)">
          <Label>{d.error.title}</Label>
          <dl className="mt-2 space-y-2.5">
            <Row label={d.error.what} text={err.what} small />
            <Row label={d.error.meaning} text={err.meaning} small />
            <Row label={d.error.fixing} text={err.fixing} small />
            <Row label={d.error.action} text={err.action} small />
          </dl>
          {err.details && (
            <details className="mt-3 text-xs text-[var(--muted)]">
              <summary className="cursor-pointer select-none hover:text-[var(--text)]">
                {d.error.details}
              </summary>
              <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--bg)] p-2 font-mono text-[11px] leading-relaxed">
                {err.details}
              </pre>
            </details>
          )}
        </Card>
      )}

      <Card>
        <Label>{d.preview.title}</Label>
        <div className="mt-2 grid min-h-24 place-items-center rounded-xl border border-dashed border-[var(--line)] px-3 py-4 text-center">
          <div>
            <p className="text-[13px]">{d.preview.unavailable}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{d.preview.hint}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Row({ label, text, small }: { label: string; text: string; small?: boolean }) {
  return (
    <div>
      <dt className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
        {label}
      </dt>
      <dd className={`mt-0.5 leading-snug ${small ? "text-[13px]" : "text-sm"}`}>{text}</dd>
    </div>
  );
}

function MonitorBadge({ d, s }: { d: Dict; s: SessionState }) {
  const on = s.monitor === "on";
  const paused = s.monitor === "paused";
  const color = on ? "var(--s-working)" : paused ? "var(--s-waiting)" : "var(--muted)";
  return (
    <span
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px]"
      style={{ color }}
      title={d.monitorBadge[s.monitor]}
    >
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${on ? "pulse" : ""}`} aria-hidden="true" />
      {d.monitorBadge[s.monitor]}
    </span>
  );
}
