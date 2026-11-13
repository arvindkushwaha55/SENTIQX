import { ago, elapsed, shortId } from "../lib/format";
import type { Dict } from "../lib/i18n";
import type { SessionState, Status } from "../lib/types";
import { Orb } from "./Orb";
import { PauseIcon, PlayIcon, StopIcon } from "./icons";
import { Button, Chip, Label } from "./ui";

interface Props {
  d: Dict;
  s: SessionState;
  status: Status | null;
  now: number;
  line: string;
  hint: string | null;
  error: string | null;
  canStart: boolean;
  connectorNote: string | null;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function StatusHero({
  d,
  s,
  status,
  now,
  line,
  hint,
  error,
  canStart,
  connectorNote,
  onStart,
  onPause,
  onResume,
  onStop,
}: Props) {
  const idle = s.monitor !== "on" ? "idle" : (status ?? "idle");
  const monitorColor =
    s.monitor === "on" ? "var(--s-working)" : s.monitor === "paused" ? "var(--s-waiting)" : "var(--faint)";
  const id = shortId(s.sessionId);

  return (
    <section className="hero rise p-4" data-status={idle}>
      <div className="flex items-center gap-4">
        <Orb status={s.monitor === "on" ? status : null} />
        <div className="min-w-0 flex-1">
          <Label>{d.labels.status}</Label>
          <p
            className="display mt-0.5 text-[21px] font-semibold leading-tight"
            style={{ color: "var(--c)" }}
            role="status"
            aria-live="polite"
          >
            {status && s.monitor === "on" ? d.status[status] : d.statusNone}
          </p>
          <p className="mt-1.5 text-[13px] leading-snug text-[var(--text)]/90">{line}</p>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap gap-1.5">
        <Chip color={monitorColor}>
          <span className={`dot ${s.monitor === "on" ? "blink" : ""}`} />
          {d.monitorBadge[s.monitor]}
        </Chip>
        {s.monitor !== "off" && (
          <Chip title={s.sessionId ?? undefined}>
            {id ? `${d.hero.session} ${id}` : d.hero.noSession}
            {s.startedAt !== null && ` · ${elapsed(now - s.startedAt)}`}
          </Chip>
        )}
        {s.project && s.monitor !== "off" && (
          <Chip title={s.project}>
            <span className="max-w-[140px] truncate">{s.project}</span>
          </Chip>
        )}
        {s.monitor === "on" && (
          <Chip>
            {d.hero.lastEvent}: {s.lastEventAt === null ? d.hero.noEvents : ago(now - s.lastEventAt, d.time)}
          </Chip>
        )}
      </div>

      {s.monitor === "paused" && <p className="mt-3 text-xs text-[var(--muted)]">{d.pausedNote}</p>}
      {hint && <p className="mt-3 text-xs leading-relaxed text-[var(--s-waiting)]">{hint}</p>}
      {error && (
        <p className="mt-3 break-words text-xs text-[var(--s-error)]" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        {s.monitor === "off" ? (
          <Button variant="primary" className="flex-1" disabled={!canStart} onClick={onStart}>
            <PlayIcon size={14} />
            {d.controls.start}
          </Button>
        ) : (
          <>
            {s.monitor === "on" ? (
              <Button className="flex-1" onClick={onPause}>
                <PauseIcon size={14} />
                {d.controls.pause}
              </Button>
            ) : (
              <Button variant="primary" className="flex-1" onClick={onResume}>
                <PlayIcon size={14} />
                {d.controls.resume}
              </Button>
            )}
            <Button variant="danger" className="flex-1" onClick={onStop}>
              <StopIcon size={13} />
              {d.controls.stop}
            </Button>
          </>
        )}
      </div>
      {connectorNote && s.monitor === "off" && (
        <p className="mt-2 text-center text-xs text-[var(--muted)]">{connectorNote}</p>
      )}
    </section>
  );
}
