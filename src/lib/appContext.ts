import type { Dict } from "./i18n";
import type { SessionState } from "./types";

export type Category = "coding" | "browser" | "terminal" | "communication" | "other";

export interface ActiveApp {
  exe: string;
  name: string;
  category: Category;
  title: string | null;
  pid: number;
}

/**
 * What SENTIQX can honestly say about the application in front. Detecting an app says
 * nothing about its content, so each level needs its own evidence.
 */
export interface AppContext {
  detected: true;
  /** An authorised data source is connected for this kind of app. */
  contextAvailable: boolean;
  /** That source has actually delivered events in this session. */
  understood: boolean;
  /** No automatic source exists for this kind of app. */
  unsupported: boolean;
}

export function appContext(app: ActiveApp, s: SessionState): AppContext {
  const claudeKind = app.category === "coding" || app.category === "terminal";
  const connected = s.monitor === "on";
  return {
    detected: true,
    contextAvailable: claudeKind && connected,
    understood: claudeKind && connected && s.sessionActive && s.lastEventAt !== null,
    unsupported: !claudeKind,
  };
}

/** One honest sentence about the app. It never describes activity it has no evidence for. */
export function contextLine(app: ActiveApp, ctx: AppContext, d: Dict): string {
  const t = d.home.context;
  switch (app.category) {
    case "coding":
    case "terminal":
      if (ctx.understood) return t.understood(app.name);
      return ctx.contextAvailable ? t.connected(app.name) : t.waitingSource(app.name);
    case "browser":
      return t.browser(app.name);
    case "communication":
      return t.communication(app.name);
    default:
      return t.other(app.name);
  }
}

export function headline(app: ActiveApp, d: Dict): string {
  return app.category === "coding" || app.category === "terminal"
    ? d.home.working(app.name)
    : d.home.using(app.name);
}

export function greeting(hour: number, d: Dict): string {
  const g = d.home.greeting;
  if (hour >= 5 && hour < 12) return g.morning;
  if (hour >= 12 && hour < 17) return g.afternoon;
  if (hour >= 17 && hour < 22) return g.evening;
  return g.night;
}
