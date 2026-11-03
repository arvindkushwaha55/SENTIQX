import { currentTool, toolKind, totalCompleted } from "./engine";
import type { Dict } from "./i18n";
import type { SessionState, Status } from "./types";

export interface Summary {
  now: string;
  done: string;
  next: string;
}

/**
 * Rule-based summary built only from reported events. Three lines at most:
 * current activity, completed work, next step (always labelled when predicted).
 */
export function buildSummary(s: SessionState, status: Status | null, nowMs: number, d: Dict): Summary {
  const done =
    totalCompleted(s) === 0
      ? d.line2.none
      : d.line2.some(
          totalCompleted(s),
          Object.entries(s.completed)
            .map(([tool, n]) => `${tool} x${n}`)
            .join(", "),
        );

  if (s.monitor === "off") return { now: d.line1.off, done: d.line2.none, next: d.line3.none };
  if (s.monitor === "paused") return { now: d.line1.paused, done, next: d.line3.none };

  switch (status) {
    case "working": {
      const tool = currentTool(s);
      return {
        now: d.line1.working(tool ? d.toolAction(toolKind(tool), tool) : null),
        done,
        next: d.line3.working,
      };
    }
    case "waiting":
      return { now: d.line1.waiting(s.waitingFor ?? "?"), done, next: d.line3.waiting };
    case "stuck": {
      const minutes = Math.max(1, Math.round((nowMs - (s.lastEventAt ?? nowMs)) / 60_000));
      return { now: d.line1.stuck(minutes), done, next: d.line3.stuck };
    }
    case "error":
      return { now: d.line1.error, done, next: d.line3.error };
    case "done":
      return { now: d.line1.done, done, next: d.line3.done };
    default:
      return { now: d.line1.none, done, next: d.line3.none };
  }
}

export interface ErrorView {
  what: string;
  meaning: string;
  fixing: string;
  action: string;
  details: string | null;
}

/** Plain-language explanation of the active error, with the raw detail kept visible. */
export function buildErrorView(s: SessionState, d: Dict): ErrorView | null {
  // Show the active error. If Claude already moved on, still show a tool failure from
  // the current turn, so the "did it retry?" answer can be backed by later activity.
  let e = s.activeError;
  if (!e && s.turnActive && s.turnStartedAt !== null) {
    const last = s.errors[s.errors.length - 1];
    if (last && last.source === "tool" && last.at >= s.turnStartedAt) e = last;
  }
  if (!e) return null;

  if (e.source === "tool") {
    const t = d.error.toolFailure(e.tool ?? "?");
    const retried = s.lastToolStartAt !== null && s.lastToolStartAt > e.at;
    return {
      what: t.what,
      meaning: t.meaning,
      fixing: retried ? d.error.fixYes : d.error.fixUnknown,
      action: d.error.actionNone,
      details: e.detail ?? null,
    };
  }

  const t = d.error.api[e.errorType ?? ""] ?? d.error.apiUnknown;
  return {
    what: t.what,
    meaning: t.meaning,
    fixing: d.error.fixUnknown,
    action: t.action ?? d.error.actionNone,
    details: [e.errorType, e.detail].filter(Boolean).join(": ") || null,
  };
}
