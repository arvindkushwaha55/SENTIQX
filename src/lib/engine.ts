import type {
  ActivityEvent,
  EngineState,
  ErrorRecord,
  FeedItem,
  SessionState,
  Status,
  ToolKind,
} from "./types";

/**
 * Inactivity only ever produces a *suspected* stuck state. A long build or a long
 * model response is silent too, so we use a longer limit while a tool is running.
 */
export const STUCK_AFTER_MS = 90_000;
export const STUCK_AFTER_MS_TOOL_RUNNING = 300_000;
export const MAX_ERRORS = 20;
export const MAX_FEED = 8;

/**
 * Bucket key for events that arrive without a session id. The Rust normaliser
 * can emit an empty session id for unusual payloads; those events get their own
 * anonymous bucket so they can never touch a real session's state.
 */
export const ANONYMOUS_SESSION = "__anonymous__";

/** One session's fresh state. Also the shape every UI consumer reads. */
export const initialState: SessionState = {
  monitor: "off",
  sessionActive: false,
  sessionId: null,
  project: null,
  feed: [],
  startedAt: null,
  lastEventAt: null,
  turnActive: false,
  turnStartedAt: null,
  turnFinishedAt: null,
  running: {},
  waitingFor: null,
  completed: {},
  errors: [],
  activeError: null,
  lastToolStartAt: null,
  nextErrorId: 1,
  ended: false,
};

export const initialEngineState: EngineState = {
  monitor: "off",
  sessions: {},
  displayedId: null,
};

export type Action =
  | { type: "monitor"; action: "start" | "pause" | "resume" | "stop"; at: number }
  | { type: "event"; event: ActivityEvent };

function addError(
  s: SessionState,
  e: Omit<ErrorRecord, "id">,
): Pick<SessionState, "errors" | "activeError" | "nextErrorId"> {
  const rec: ErrorRecord = { id: s.nextErrorId, ...e };
  return {
    errors: [...s.errors, rec].slice(-MAX_ERRORS),
    activeError: rec,
    nextErrorId: s.nextErrorId + 1,
  };
}

function removeRunning(running: Record<string, string>, tool: string, id?: string) {
  const next = { ...running };
  if (id && id in next) {
    delete next[id];
    return next;
  }
  const key = Object.keys(next).find((k) => next[k] === tool);
  if (key) delete next[key];
  return next;
}

let anonSeq = 0;

function feedItem(ev: ActivityEvent): FeedItem | null {
  switch (ev.kind) {
    case "prompt":
      return { at: ev.at, kind: "prompt" };
    case "tool_end":
      return { at: ev.at, kind: "tool", tool: ev.tool, ok: ev.ok, interrupted: ev.interrupted };
    case "permission_request":
      return { at: ev.at, kind: "wait", tool: ev.tool };
    case "turn_stop":
      return { at: ev.at, kind: "stop" };
    case "api_error":
      return { at: ev.at, kind: "error", errorType: ev.errorType };
    case "session_end":
      return { at: ev.at, kind: "end" };
    default:
      return null; // session_start / tool_start are not shown: "Now" already covers them
  }
}

/**
 * Apply one event to ONE session's bucket, then maintain that bucket's feed.
 * The per-event semantics are exactly the old single-session engine's; the
 * multi-session safety comes from never letting an event touch another bucket.
 */
function applyEvent(bucket: SessionState, key: string, ev: ActivityEvent): SessionState {
  const next = stepBucket(bucket, ev);
  const item = feedItem(ev);
  return {
    ...next,
    sessionId: key === ANONYMOUS_SESSION ? null : key,
    project: ev.project || next.project,
    feed: item ? [...next.feed, item].slice(-MAX_FEED) : next.feed,
    ended: ev.kind === "session_end" ? true : next.ended,
  };
}

function stepBucket(s: SessionState, ev: ActivityEvent): SessionState {
  const base: SessionState = { ...s, monitor: "on", lastEventAt: ev.at };

  switch (ev.kind) {
    case "session_start":
      return { ...base, sessionActive: true, startedAt: s.startedAt ?? ev.at };

    case "prompt":
      return {
        ...base,
        sessionActive: true,
        startedAt: s.startedAt ?? ev.at,
        turnActive: true,
        turnStartedAt: ev.at,
        turnFinishedAt: null,
        waitingFor: null,
        activeError: null,
      };

    case "tool_start": {
      const key = ev.id ?? `${ev.tool}#${++anonSeq}`;
      return {
        ...base,
        sessionActive: true,
        startedAt: s.startedAt ?? ev.at,
        turnActive: true,
        turnStartedAt: s.turnActive ? s.turnStartedAt : ev.at,
        turnFinishedAt: null,
        running: { ...s.running, [key]: ev.tool },
        waitingFor: null,
        activeError: null,
        lastToolStartAt: ev.at,
      };
    }

    case "permission_request":
      return {
        ...base,
        sessionActive: true,
        startedAt: s.startedAt ?? ev.at,
        turnActive: true,
        turnStartedAt: s.turnActive ? s.turnStartedAt : ev.at,
        turnFinishedAt: null,
        waitingFor: ev.tool,
      };

    case "tool_end": {
      const running = removeRunning(s.running, ev.tool, ev.id);
      if (ev.interrupted) {
        // Cancelled by the user: neither completed work nor an error.
        return { ...base, running, waitingFor: null };
      }
      if (ev.ok) {
        return {
          ...base,
          running,
          waitingFor: null,
          completed: { ...s.completed, [ev.tool]: (s.completed[ev.tool] ?? 0) + 1 },
        };
      }
      return {
        ...base,
        running,
        waitingFor: null,
        ...addError(s, { at: ev.at, source: "tool", tool: ev.tool, detail: ev.error }),
      };
    }

    case "turn_stop":
      return {
        ...base,
        turnActive: false,
        turnFinishedAt: ev.at,
        running: {},
        waitingFor: null,
        // A single failed tool call that Claude then moved past is not an error state
        // for the whole turn. API errors stay until the next prompt.
        activeError: s.activeError?.source === "api" ? s.activeError : null,
      };

    case "api_error":
      return {
        ...base,
        turnActive: false,
        running: {},
        waitingFor: null,
        ...addError(s, { at: ev.at, source: "api", errorType: ev.errorType, detail: ev.detail }),
      };

    case "session_end":
      return {
        ...base,
        sessionActive: false,
        turnActive: false,
        running: {},
        waitingFor: null,
      };
  }
}

/** Resume drops stale live state per bucket; counts and error history are kept. */
function resumeBucket(s: SessionState): SessionState {
  return {
    ...s,
    monitor: "on",
    turnActive: false,
    turnStartedAt: null,
    turnFinishedAt: null,
    running: {},
    waitingFor: null,
    activeError: null,
    lastEventAt: null,
  };
}

/** The still-active bucket with the most recent event, or null when none is active. */
function mostRecentActive(sessions: Record<string, SessionState>): string | null {
  let best: string | null = null;
  let bestAt = -Infinity;
  for (const [key, b] of Object.entries(sessions)) {
    if (!b.sessionActive) continue;
    const at = b.lastEventAt ?? 0;
    if (at > bestAt) {
      bestAt = at;
      best = key;
    }
  }
  return best;
}

export function engineReducer(s: EngineState, a: Action): EngineState {
  if (a.type === "monitor") {
    switch (a.action) {
      case "start":
        return { monitor: "on", sessions: {}, displayedId: null };
      case "stop":
        return { ...initialEngineState };
      case "pause":
        return s.monitor === "on" ? { ...s, monitor: "paused" } : s;
      case "resume": {
        if (s.monitor !== "paused") return s;
        // Events during the pause were not recorded, so live state may be stale.
        // Drop it instead of guessing, in every session bucket alike.
        const sessions: Record<string, SessionState> = {};
        for (const [key, b] of Object.entries(s.sessions)) sessions[key] = resumeBucket(b);
        return { ...s, monitor: "on", sessions };
      }
    }
  }

  // Events are ignored unless monitoring is on (pause really means not recording).
  if (s.monitor !== "on") return s;

  const ev = a.event;
  const key = ev.sessionId ? ev.sessionId : ANONYMOUS_SESSION;
  const existing = s.sessions[key];

  // A delayed event from an already-ended session must not reactivate it or
  // steal the display. Only a genuinely fresh start (start/prompt) revives it,
  // and then as a clean bucket.
  if (existing?.ended && ev.kind !== "session_start" && ev.kind !== "prompt") return s;

  const base: SessionState =
    !existing || existing.ended ? { ...initialState, monitor: "on" } : existing;
  const bucket = applyEvent(base, key, ev);
  const sessions = { ...s.sessions, [key]: bucket };

  let displayedId = s.displayedId;
  if (bucket.sessionActive) {
    // Most recent activity wins the display.
    displayedId = key;
  } else if (bucket.ended) {
    // The displayed session just ended: fall back to another live session if
    // one exists, otherwise keep showing the ended one (status derives null).
    if (displayedId === key) displayedId = mostRecentActive(sessions) ?? key;
  } else if (displayedId === null || !sessions[displayedId]?.sessionActive) {
    // Evidence without an active session (e.g. an API error as a session's
    // first seen event): show it when nothing live is on display, but never
    // steal the display from a session that is actively working.
    displayedId = key;
  }
  return { monitor: s.monitor, sessions, displayedId };
}

/**
 * The SessionState the UI should show: the most recently active session's
 * bucket, with the engine-wide monitor state applied. Every existing consumer
 * (status, summary, notifications, views) keeps reading this shape unchanged.
 */
export function displayedSession(s: EngineState): SessionState {
  const bucket = s.displayedId ? s.sessions[s.displayedId] : undefined;
  if (!bucket) return { ...initialState, monitor: s.monitor };
  return { ...bucket, monitor: s.monitor };
}

/** Returns null when there is no evidence for any status (never guesses). */
export function deriveStatus(s: SessionState, now: number): Status | null {
  if (s.monitor !== "on" || !s.sessionActive) return null;
  if (s.activeError) return "error";
  if (s.waitingFor) return "waiting";
  if (s.turnActive) {
    const idle = s.lastEventAt === null ? 0 : now - s.lastEventAt;
    const limit = Object.keys(s.running).length > 0 ? STUCK_AFTER_MS_TOOL_RUNNING : STUCK_AFTER_MS;
    return idle > limit ? "stuck" : "working";
  }
  if (s.turnFinishedAt !== null) return "done";
  return null;
}

export function toolKind(tool: string): ToolKind {
  switch (tool) {
    case "Write":
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return "edit";
    case "Bash":
    case "PowerShell":
      return "run";
    case "Read":
    case "Grep":
    case "Glob":
    case "LS":
      return "read";
    case "WebFetch":
    case "WebSearch":
      return "web";
    case "Agent":
    case "Task":
      return "agent";
    default:
      return "other";
  }
}

/** The tool most recently reported as started and still running. */
export function currentTool(s: SessionState): string | null {
  const tools = Object.values(s.running);
  return tools.length > 0 ? tools[tools.length - 1] : null;
}

export function totalCompleted(s: SessionState): number {
  return Object.values(s.completed).reduce((a, b) => a + b, 0);
}
