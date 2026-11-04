import { describe, expect, it } from "vitest";
import {
  STUCK_AFTER_MS,
  STUCK_AFTER_MS_TOOL_RUNNING,
  deriveStatus,
  initialState,
  reducer,
  type Action,
} from "./engine";
import { dictionaries } from "./i18n";
import { buildErrorView, buildSummary } from "./summary";
import type { ActivityEvent, SessionState } from "./types";

const run = (events: ActivityEvent[], start = true): SessionState => {
  const actions: Action[] = [
    ...(start ? [{ type: "monitor", action: "start", at: 0 } as Action] : []),
    ...events.map((event) => ({ type: "event", event }) as Action),
  ];
  return actions.reduce(reducer, initialState);
};

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
    let s = run([{ kind: "prompt", at: 10 }]);
    expect(deriveStatus(s, 20)).toBe("working");
    s = reducer(s, { type: "event", event: { kind: "turn_stop", at: 30 } });
    expect(deriveStatus(s, 40)).toBe("done");
  });

  it("WAITING only when a permission request was reported", () => {
    const s = run([{ kind: "prompt", at: 1 }, { kind: "permission_request", at: 2, tool: "Write" }]);
    expect(deriveStatus(s, 3)).toBe("waiting");
    const s2 = reducer(s, { type: "event", event: { kind: "tool_start", at: 4, tool: "Write", id: "a" } });
    expect(deriveStatus(s2, 5)).toBe("working");
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
    let s = run([
      { kind: "tool_start", at: 1, tool: "PowerShell", id: "x" },
      { kind: "tool_end", at: 2, tool: "PowerShell", id: "x", ok: false, error: "boom" },
    ]);
    expect(deriveStatus(s, 3)).toBe("error");
    expect(s.completed).toEqual({});
    s = reducer(s, { type: "event", event: { kind: "tool_start", at: 4, tool: "Read", id: "y" } });
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
    let s = run([{ kind: "prompt", at: 1 }, { kind: "api_error", at: 2, errorType: "rate_limit" }]);
    expect(deriveStatus(s, 3)).toBe("error");
    s = reducer(s, { type: "event", event: { kind: "turn_stop", at: 4 } });
    expect(deriveStatus(s, 5)).toBe("error");
    s = reducer(s, { type: "event", event: { kind: "prompt", at: 6 } });
    expect(deriveStatus(s, 7)).toBe("working");
  });

  it("pause records nothing, and resume drops stale live state", () => {
    let s = run([{ kind: "permission_request", at: 1, tool: "Write" }]);
    s = reducer(s, { type: "monitor", action: "pause", at: 2 });
    const before = s;
    s = reducer(s, { type: "event", event: { kind: "turn_stop", at: 3 } });
    expect(s).toEqual(before);
    expect(deriveStatus(s, 4)).toBeNull();
    s = reducer(s, { type: "monitor", action: "resume", at: 5 });
    expect(s.monitor).toBe("on");
    expect(s.waitingFor).toBeNull();
  });

  it("keeps a short feed of real events and the session id", () => {
    let s = run([{ kind: "prompt", at: 1, sessionId: "abc" }]);
    for (let i = 0; i < 12; i++) {
      s = reducer(s, { type: "event", event: { kind: "tool_end", at: 10 + i, tool: "Read", ok: true } });
    }
    expect(s.sessionId).toBe("abc");
    expect(s.feed).toHaveLength(8); // capped
    expect(s.feed[0].kind).toBe("tool");
    // tool_start is not listed, and ignored events add nothing
    const before = s.feed.length;
    s = reducer(s, { type: "event", event: { kind: "tool_start", at: 99, tool: "Read", id: "z" } });
    expect(s.feed).toHaveLength(before);
    const off = reducer(initialState, { type: "event", event: { kind: "prompt", at: 1 } });
    expect(off.feed).toHaveLength(0);
  });

  it("stop clears everything", () => {
    const s = reducer(run([{ kind: "prompt", at: 1 }]), { type: "monitor", action: "stop", at: 2 });
    expect(s).toEqual(initialState);
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
    const failed = run([
      { kind: "prompt", at: 1 },
      { kind: "tool_end", at: 2, tool: "Bash", ok: false, error: "x" },
    ]);
    expect(buildErrorView(failed, en)?.fixing).toBe(en.error.fixUnknown);
    const retried = reducer(failed, { type: "event", event: { kind: "tool_start", at: 3, tool: "Bash", id: "q" } });
    expect(deriveStatus(retried, 4)).toBe("working");
    expect(buildErrorView(retried, en)?.fixing).toBe(en.error.fixYes);
    // a new prompt starts a new turn, so the old failure disappears
    const next = reducer(retried, { type: "event", event: { kind: "prompt", at: 10 } });
    expect(buildErrorView(next, en)).toBeNull();
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
