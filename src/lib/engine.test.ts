import { describe, expect, it } from "vitest";
import {
  ANONYMOUS_SESSION,
  STUCK_AFTER_MS,
  STUCK_AFTER_MS_TOOL_RUNNING,
  deriveStatus,
  displayedSession,
  engineReducer,
  initialEngineState,
  initialState,
  type Action,
} from "./engine";
import { dictionaries } from "./i18n";
import { buildErrorView, buildSummary } from "./summary";
import type { ActivityEvent, EngineState, SessionState } from "./types";

/** Run events through the engine (monitoring started first, unless told not to). */
const runEngine = (events: ActivityEvent[], start = true): EngineState => {
  const actions: Action[] = [
    ...(start ? [{ type: "monitor", action: "start", at: 0 } as Action] : []),
    ...events.map((event) => ({ type: "event", event }) as Action),
  ];
  return actions.reduce(engineReducer, initialEngineState);
};

/** The single-session view the UI would show after these events. */
const run = (events: ActivityEvent[], start = true): SessionState =>
  displayedSession(runEngine(events, start));

const send = (e: EngineState, event: ActivityEvent): EngineState =>
  engineReducer(e, { type: "event", event });

describe("status engine", () => {
  it("has no status without evidence", () => {
    expect(deriveStatus(run([]), 1000)).toBeNull();
    expect(deriveStatus(initialState, 1000)).toBeNull();
  });

  it("ignores events while monitoring is off", () => {
    const s = run([{ kind: "prompt", at: 1 }], false);
    expect(s).toEqual(initialState);
  });

  it("WORKING after a prompt, DONE only after a turn stop", () => {
    let e = runEngine([{ kind: "prompt", at: 10 }]);
    expect(deriveStatus(displayedSession(e), 20)).toBe("working");
    e = send(e, { kind: "turn_stop", at: 30 });
    expect(deriveStatus(displayedSession(e), 40)).toBe("done");
  });

  it("WAITING only when a permission request was reported", () => {
    let e = runEngine([
      { kind: "prompt", at: 1 },
      { kind: "permission_request", at: 2, tool: "Write" },
    ]);
    expect(deriveStatus(displayedSession(e), 3)).toBe("waiting");
    e = send(e, { kind: "tool_start", at: 4, tool: "Write", id: "a" });
    expect(deriveStatus(displayedSession(e), 5)).toBe("working");
  });

  it("inactivity gives STUCK only after the threshold, longer while a tool runs", () => {
    const idle = run([{ kind: "prompt", at: 0 }]);
    expect(deriveStatus(idle, STUCK_AFTER_MS)).toBe("working");
    expect(deriveStatus(idle, STUCK_AFTER_MS + 1)).toBe("stuck");

    const tool = run([{ kind: "tool_start", at: 0, tool: "PowerShell", id: "t" }]);
    expect(deriveStatus(tool, STUCK_AFTER_MS + 1)).toBe("working");
    expect(deriveStatus(tool, STUCK_AFTER_MS_TOOL_RUNNING + 1)).toBe("stuck");
  });

  it("a failed tool shows ERROR, and moves back to WORKING when Claude continues", () => {
    let e = runEngine([
      { kind: "tool_start", at: 1, tool: "PowerShell", id: "x" },
      { kind: "tool_end", at: 2, tool: "PowerShell", id: "x", ok: false, error: "boom" },
    ]);
    let s = displayedSession(e);
    expect(deriveStatus(s, 3)).toBe("error");
    expect(s.completed).toEqual({});
    e = send(e, { kind: "tool_start", at: 4, tool: "Read", id: "y" });
    s = displayedSession(e);
    expect(deriveStatus(s, 5)).toBe("working");
    expect(s.errors).toHaveLength(1); // history is kept
  });

  it("counts only successful tools as completed", () => {
    const s = run([
      { kind: "tool_start", at: 1, tool: "Write", id: "a" },
      { kind: "tool_end", at: 2, tool: "Write", id: "a", ok: true },
      { kind: "tool_start", at: 3, tool: "Write", id: "b" },
      { kind: "tool_end", at: 4, tool: "Write", id: "b", ok: true },
    ]);
    expect(s.completed).toEqual({ Write: 2 });
  });

  it("a cancelled tool is neither completed nor an error", () => {
    const s = run([
      { kind: "prompt", at: 1 },
      { kind: "tool_start", at: 2, tool: "PowerShell", id: "c" },
      { kind: "tool_end", at: 3, tool: "PowerShell", id: "c", ok: false, interrupted: true },
    ]);
    expect(s.completed).toEqual({});
    expect(s.errors).toHaveLength(0);
    expect(s.running).toEqual({});
    expect(deriveStatus(s, 4)).toBe("working");
  });

  it("an API error stays ERROR until the next prompt", () => {
    let e = runEngine([{ kind: "prompt", at: 1 }, { kind: "api_error", at: 2, errorType: "rate_limit" }]);
    expect(deriveStatus(displayedSession(e), 3)).toBe("error");
    e = send(e, { kind: "turn_stop", at: 4 });
    expect(deriveStatus(displayedSession(e), 5)).toBe("error");
    e = send(e, { kind: "prompt", at: 6 });
    expect(deriveStatus(displayedSession(e), 7)).toBe("working");
  });

  it("pause records nothing, and resume drops stale live state", () => {
    let e = runEngine([{ kind: "permission_request", at: 1, tool: "Write" }]);
    e = engineReducer(e, { type: "monitor", action: "pause", at: 2 });
    const before = displayedSession(e);
    e = send(e, { kind: "turn_stop", at: 3 });
    expect(displayedSession(e)).toEqual(before);
    expect(deriveStatus(displayedSession(e), 4)).toBeNull();
    e = engineReducer(e, { type: "monitor", action: "resume", at: 5 });
    const s = displayedSession(e);
    expect(s.monitor).toBe("on");
    expect(s.waitingFor).toBeNull();
  });

  it("keeps a short feed of real events and the session id", () => {
    // Real hook events always carry the session id; these do too.
    let e = runEngine([{ kind: "prompt", at: 1, sessionId: "abc" }]);
    for (let i = 0; i < 12; i++) {
      e = send(e, { kind: "tool_end", at: 10 + i, tool: "Read", ok: true, sessionId: "abc" });
    }
    const s = displayedSession(e);
    expect(s.sessionId).toBe("abc");
    expect(s.feed).toHaveLength(8); // capped
    expect(s.feed[0].kind).toBe("tool");
    // tool_start is not listed, and ignored events add nothing
    const before = s.feed.length;
    const s2 = displayedSession(
      send(e, { kind: "tool_start", at: 99, tool: "Read", id: "z", sessionId: "abc" }),
    );
    expect(s2.feed).toHaveLength(before);
    const off = displayedSession(
      engineReducer(initialEngineState, { type: "event", event: { kind: "prompt", at: 1 } }),
    );
    expect(off.feed).toHaveLength(0);
  });

  it("stop clears everything", () => {
    const e = engineReducer(runEngine([{ kind: "prompt", at: 1 }]), {
      type: "monitor",
      action: "stop",
      at: 2,
    });
    expect(displayedSession(e)).toEqual(initialState);
    expect(e.sessions).toEqual({});
    expect(e.displayedId).toBeNull();
  });
});

describe("multiple sessions", () => {
  const P = (sessionId: string, at: number): ActivityEvent => ({ kind: "prompt", at, sessionId });

  it("two sessions run simultaneously without sharing state", () => {
    const e = runEngine([
      P("A", 1),
      { kind: "tool_start", at: 2, tool: "Write", id: "a1", sessionId: "A" },
      P("B", 3),
      { kind: "tool_start", at: 4, tool: "Read", id: "b1", sessionId: "B" },
      { kind: "tool_end", at: 5, tool: "Write", id: "a1", ok: true, sessionId: "A" },
    ]);
    expect(e.sessions["A"].running).toEqual({});
    expect(e.sessions["A"].completed).toEqual({ Write: 1 });
    expect(e.sessions["B"].running).toEqual({ b1: "Read" });
    expect(e.sessions["B"].completed).toEqual({});
    expect(e.sessions["A"].sessionActive).toBe(true);
    expect(e.sessions["B"].sessionActive).toBe(true);
    // The most recently active session (A, via its tool_end) is displayed.
    expect(displayedSession(e).sessionId).toBe("A");
    expect(deriveStatus(displayedSession(e), 6)).toBe("working");
  });

  it("session A ends while session B is working: B's status survives", () => {
    const e = runEngine([
      P("A", 1),
      P("B", 2),
      { kind: "tool_start", at: 3, tool: "Read", id: "b1", sessionId: "B" },
      { kind: "session_end", at: 4, sessionId: "A" },
    ]);
    expect(e.sessions["A"].sessionActive).toBe(false);
    expect(e.sessions["B"].running).toEqual({ b1: "Read" }); // not cleared by A's end
    const view = displayedSession(e);
    expect(view.sessionId).toBe("B");
    expect(deriveStatus(view, 5)).toBe("working");
  });

  it("session B ends while session A is working: A's status survives", () => {
    const e = runEngine([
      P("A", 1),
      P("B", 2),
      { kind: "tool_start", at: 3, tool: "Write", id: "a1", sessionId: "A" },
      { kind: "session_end", at: 4, sessionId: "B" },
    ]);
    expect(e.sessions["B"].sessionActive).toBe(false);
    expect(e.sessions["A"].running).toEqual({ a1: "Write" });
    const view = displayedSession(e);
    expect(view.sessionId).toBe("A");
    expect(deriveStatus(view, 5)).toBe("working");
  });

  it("the displayed session falls back to a live one when it ends", () => {
    const e = runEngine([
      P("A", 1),
      P("B", 2), // B is displayed (most recent)
      { kind: "session_end", at: 3, sessionId: "B" },
    ]);
    expect(e.displayedId).toBe("A");
    expect(deriveStatus(displayedSession(e), 4)).toBe("working");
  });

  it("delayed events from an ended session cannot reactivate it or hurt others", () => {
    const e = runEngine([
      P("A", 1),
      P("B", 2),
      { kind: "tool_start", at: 3, tool: "Read", id: "b1", sessionId: "B" },
      { kind: "session_end", at: 4, sessionId: "A" },
      // Out-of-order arrivals from the already-ended A:
      { kind: "tool_start", at: 5, tool: "Write", id: "late", sessionId: "A" },
      { kind: "turn_stop", at: 6, sessionId: "A" },
    ]);
    expect(e.sessions["A"].ended).toBe(true);
    expect(e.sessions["A"].sessionActive).toBe(false);
    expect(e.sessions["A"].running).toEqual({}); // the late tool_start was ignored
    expect(e.sessions["B"].running).toEqual({ b1: "Read" }); // A's stop cleared nothing of B's
    const view = displayedSession(e);
    expect(view.sessionId).toBe("B");
    expect(deriveStatus(view, 7)).toBe("working");
  });

  it("the displayed session switches to whichever session was active last", () => {
    let e = runEngine([P("A", 1)]);
    expect(e.displayedId).toBe("A");
    e = send(e, P("B", 2));
    expect(e.displayedId).toBe("B");
    e = send(e, { kind: "permission_request", at: 3, tool: "Write", sessionId: "A" });
    expect(e.displayedId).toBe("A");
    expect(deriveStatus(displayedSession(e), 4)).toBe("waiting");
  });

  it("an error in one session stays in its bucket while another works on", () => {
    const e = runEngine([
      { kind: "tool_start", at: 1, tool: "PowerShell", id: "x", sessionId: "A" },
      { kind: "tool_end", at: 2, tool: "PowerShell", id: "x", ok: false, error: "boom", sessionId: "A" },
      P("B", 3),
    ]);
    expect(e.sessions["A"].errors).toHaveLength(1);
    expect(deriveStatus(e.sessions["A"], 4)).toBe("error"); // A's own status is error
    expect(e.sessions["B"].errors).toHaveLength(0);
    expect(e.sessions["B"].activeError).toBeNull();
    const view = displayedSession(e);
    expect(view.sessionId).toBe("B");
    expect(deriveStatus(view, 4)).toBe("working"); // B is unaffected
  });

  it("no active sessions remaining: no status is shown, monitoring stays on", () => {
    const e = runEngine([
      P("A", 1),
      P("B", 2),
      { kind: "session_end", at: 3, sessionId: "A" },
      { kind: "session_end", at: 4, sessionId: "B" },
    ]);
    expect(e.monitor).toBe("on");
    const view = displayedSession(e);
    expect(view.sessionActive).toBe(false);
    expect(deriveStatus(view, 5)).toBeNull();
  });

  it("events without a session id use the anonymous bucket and cannot end a real session", () => {
    const e = runEngine([P("real", 1), { kind: "session_end", at: 2 }]); // no sessionId
    expect(e.sessions["real"].sessionActive).toBe(true);
    expect(e.sessions["real"].ended).toBe(false);
    expect(e.sessions[ANONYMOUS_SESSION].ended).toBe(true);
    const view = displayedSession(e);
    expect(view.sessionId).toBe("real");
    expect(deriveStatus(view, 3)).toBe("working");

    const anonOnly = runEngine([{ kind: "prompt", at: 1 }]);
    expect(anonOnly.sessions[ANONYMOUS_SESSION].sessionActive).toBe(true);
    expect(displayedSession(anonOnly).sessionId).toBeNull();
    expect(deriveStatus(displayedSession(anonOnly), 2)).toBe("working");
  });

  it("a fresh prompt revives an ended session as a clean bucket", () => {
    const e = runEngine([
      { kind: "tool_start", at: 1, tool: "PowerShell", id: "x", sessionId: "A" },
      { kind: "tool_end", at: 2, tool: "PowerShell", id: "x", ok: false, error: "boom", sessionId: "A" },
      { kind: "session_end", at: 3, sessionId: "A" },
      P("A", 4), // same id, genuinely new session
    ]);
    expect(e.sessions["A"].ended).toBe(false);
    expect(e.sessions["A"].sessionActive).toBe(true);
    expect(e.sessions["A"].errors).toHaveLength(0); // clean bucket, no stale error
    expect(deriveStatus(displayedSession(e), 5)).toBe("working");
  });
});

describe("summaries and errors", () => {
  const en = dictionaries.en;

  it("never claims completed work that did not happen", () => {
    const s = run([{ kind: "prompt", at: 1 }]);
    expect(buildSummary(s, "working", 2, en).done).toBe(en.line2.none);
  });

  it("labels predictions", () => {
    const s = run([{ kind: "prompt", at: 1 }]);
    expect(buildSummary(s, "working", 2, en).next.startsWith("Likely next:")).toBe(true);
  });

  it("only suggests a retry when later activity exists", () => {
    const failed = runEngine([
      { kind: "prompt", at: 1 },
      { kind: "tool_end", at: 2, tool: "Bash", ok: false, error: "x" },
    ]);
    expect(buildErrorView(displayedSession(failed), en)?.fixing).toBe(en.error.fixUnknown);
    const retried = send(failed, { kind: "tool_start", at: 3, tool: "Bash", id: "q" });
    expect(deriveStatus(displayedSession(retried), 4)).toBe("working");
    expect(buildErrorView(displayedSession(retried), en)?.fixing).toBe(en.error.fixYes);
    // a new prompt starts a new turn, so the old failure disappears
    const next = send(retried, { kind: "prompt", at: 10 });
    expect(buildErrorView(displayedSession(next), en)).toBeNull();
  });

  it("explains known API errors and keeps raw details", () => {
    const s = run([{ kind: "api_error", at: 1, errorType: "rate_limit", detail: "429" }]);
    const v = buildErrorView(s, en);
    expect(v?.what).toBe(en.error.api.rate_limit.what);
    expect(v?.details).toBe("rate_limit: 429");
  });

  it("English and Hinglish define the same error types", () => {
    expect(Object.keys(dictionaries.hinglish.error.api).sort()).toEqual(
      Object.keys(dictionaries.en.error.api).sort(),
    );
  });
});
