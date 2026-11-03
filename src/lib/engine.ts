import type { ActivityEvent, ErrorRecord, SessionState, Status, ToolKind } from "./types";

/**
 * Inactivity only ever produces a *suspected* stuck state. A long build or a long
 * model response is silent too, so we use a longer limit while a tool is running.
 */
export const STUCK_AFTER_MS = 90_000;
export const STUCK_AFTER_MS_TOOL_RUNNING = 300_000;
export const MAX_ERRORS = 20;

export const initialState: SessionState = {
  monitor: "off",
  sessionActive: false,
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

export function reducer(s: SessionState, a: Action): SessionState {
  if (a.type === "monitor") {
    switch (a.action) {
      case "start":
        return { ...initialState, monitor: "on" };
      case "stop":
        return { ...initialState };
      case "pause":
        return s.monitor === "on" ? { ...s, monitor: "paused" } : s;
      case "resume":
        if (s.monitor !== "paused") return s;
        // Events during the pause were not recorded, so live state may be stale.
        // Drop it instead of guessing; counts and error history are kept.
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
  }

  // Events are ignored unless monitoring is on (pause really means not recording).
  if (s.monitor !== "on") return s;

  const ev = a.event;
  const base: SessionState = { ...s, lastEventAt: ev.at };

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
