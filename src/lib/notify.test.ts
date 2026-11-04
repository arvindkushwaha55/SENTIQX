import { describe, expect, it } from "vitest";
import { initialState } from "./engine";
import { dictionaries } from "./i18n";
import { notificationFor } from "./notify";
import type { SessionState } from "./types";

const en = dictionaries.en;
const s = (over: Partial<SessionState>): SessionState => ({ ...initialState, monitor: "on", ...over });

describe("notificationFor", () => {
  it("never repeats while the status stays the same", () => {
    expect(notificationFor("waiting", "waiting", s({ waitingFor: "Write" }), en)).toBeNull();
    expect(notificationFor("working", null, s({}), en)).toBeNull();
    expect(notificationFor("waiting", "working", s({}), en)).toBeNull();
  });

  it("tells you when your input is needed", () => {
    expect(notificationFor("working", "waiting", s({ waitingFor: "Write" }), en)?.body).toContain("Write");
  });

  it("stays quiet for a routine tool failure, speaks up for an API error", () => {
    const tool = s({ activeError: { id: 1, at: 1, source: "tool", tool: "Bash" } });
    expect(notificationFor("working", "error", tool, en)).toBeNull();
    const api = s({ activeError: { id: 2, at: 1, source: "api", errorType: "rate_limit" } });
    expect(notificationFor("working", "error", api, en)?.body).toBe(en.error.api.rate_limit.what);
  });

  it("only announces DONE for longer turns", () => {
    expect(notificationFor("working", "done", s({ turnStartedAt: 0, turnFinishedAt: 5_000 }), en)).toBeNull();
    expect(notificationFor("working", "done", s({ turnStartedAt: 0, turnFinishedAt: 60_000 }), en)?.title).toBe(en.notify.doneTitle);
  });

  it("uses the selected language", () => {
    const hi = dictionaries.hinglish;
    const n = notificationFor("working", "stuck", s({}), hi);
    expect(n?.title).toBe(hi.notify.stuckTitle);
    expect(n?.title).not.toBe(en.notify.stuckTitle);
  });
});
