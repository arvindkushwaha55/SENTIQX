import { describe, expect, it } from "vitest";
import { type ActiveApp, appContext, contextLine, greeting, headline } from "./appContext";
import { pushRecent } from "./awareness";
import { displayedSession, engineReducer, initialEngineState, initialState } from "./engine";
import { dictionaries } from "./i18n";

const app = (name: string, category: ActiveApp["category"]): ActiveApp => ({ exe: name, name, category, title: null, pid: 1 });
const en = dictionaries.en;
const hi = dictionaries.hinglish;

const monitoring = engineReducer(initialEngineState, { type: "monitor", action: "start", at: 0 });
const withEvents = displayedSession(
  engineReducer(monitoring, { type: "event", event: { kind: "prompt", at: 1, sessionId: "s" } }),
);

describe("appContext", () => {
  it("detection alone never means understanding", () => {
    const c = appContext(app("VS Code", "coding"), initialState);
    expect(c).toMatchObject({ detected: true, contextAvailable: false, understood: false, unsupported: false });
    expect(contextLine(app("VS Code", "coding"), c, en)).toBe("VS Code detected. Waiting for an authorised activity source.");
  });

  it("a connected source is not understanding until events have arrived", () => {
    const vs = app("VS Code", "coding");
    expect(appContext(vs, displayedSession(monitoring))).toMatchObject({ contextAvailable: true, understood: false });
    expect(appContext(vs, withEvents)).toMatchObject({ contextAvailable: true, understood: true });
  });

  it("browsers, chats and other apps are honestly unsupported, even while Claude is active", () => {
    for (const a of [app("Google Chrome", "browser"), app("WhatsApp", "communication"), app("Paint", "other")]) {
      expect(appContext(a, withEvents)).toMatchObject({ contextAvailable: false, understood: false, unsupported: true });
    }
    expect(contextLine(app("Paint", "other"), appContext(app("Paint", "other"), initialState), en)).toContain("Paint detected");
  });

  it("each language gives its own sentence and never the other's", () => {
    const vs = app("VS Code", "coding");
    expect(headline(vs, en)).toBe("You're currently working in VS Code.");
    expect(headline(vs, hi)).not.toBe(headline(vs, en));
    const c = appContext(vs, initialState);
    expect(contextLine(vs, c, hi)).not.toContain("Waiting for");
  });

  it("greets by the time of day", () => {
    expect(greeting(8, en)).toBe(en.home.greeting.morning);
    expect(greeting(14, en)).toBe(en.home.greeting.afternoon);
    expect(greeting(19, en)).toBe(en.home.greeting.evening);
    expect(greeting(2, en)).toBe(en.home.greeting.night);
  });
});

describe("pushRecent", () => {
  it("records switches, ignores repeats and stays short", () => {
    let r = pushRecent([], app("A", "other"), 1);
    r = pushRecent(r, app("A", "other"), 2);
    expect(r).toHaveLength(1);
    for (const n of ["B", "C", "D", "E", "F", "G"]) r = pushRecent(r, app(n, "other"), 3);
    expect(r).toHaveLength(5);
    expect(r[0].name).toBe("G");
  });
});
