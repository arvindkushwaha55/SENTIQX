import { describe, expect, it } from "vitest";
import { toActivityEvent } from "./connector";

describe("toActivityEvent", () => {
  it("accepts events shaped like the Rust receiver sends", () => {
    const e = toActivityEvent({ kind: "tool_end", at: 5, sessionId: "s", tool: "Write", id: "t", ok: true });
    expect(e?.kind).toBe("tool_end");
    expect(toActivityEvent({ kind: "api_error", at: 1, errorType: "rate_limit" })).not.toBeNull();
    expect(toActivityEvent({ kind: "turn_stop", at: 1 })).not.toBeNull();
  });

  it("drops anything malformed instead of guessing", () => {
    expect(toActivityEvent(null)).toBeNull();
    expect(toActivityEvent("x")).toBeNull();
    expect(toActivityEvent({ kind: "mystery", at: 1 })).toBeNull();
    expect(toActivityEvent({ kind: "turn_stop" })).toBeNull();
    expect(toActivityEvent({ kind: "tool_start", at: 1 })).toBeNull(); // no tool name
    expect(toActivityEvent({ kind: "tool_end", at: 1, tool: "Write" })).toBeNull(); // no ok flag
    expect(toActivityEvent({ kind: "api_error", at: 1 })).toBeNull(); // no error type
  });
});
