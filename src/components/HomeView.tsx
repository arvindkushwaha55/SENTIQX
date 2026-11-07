import { type ActiveApp, type Category, appContext, contextLine, greeting, headline } from "../lib/appContext";
import type { AwarenessPrefs, RecentApp } from "../lib/awareness";
import { ago } from "../lib/format";
import type { Dict } from "../lib/i18n";
import { buildSummary } from "../lib/summary";
import type { SessionState, Status } from "../lib/types";
import type { View } from "./NavBar";
import { Orb } from "./Orb";
import { ZoneCard } from "./ZoneCard";
import { AppIcon, ChatIcon, CheckIcon, CloseIcon, CodeIcon, EyeIcon, GearIcon, GlobeIcon, PulseIcon, ShieldIcon, TerminalIcon } from "./icons";
import { Button, Card, Chip, Label } from "./ui";

const CATEGORY: Record<Category, { Icon: typeof AppIcon; color: string }> = {
  coding: { Icon: CodeIcon, color: "var(--cyan)" },
  browser: { Icon: GlobeIcon, color: "var(--blue)" },
  terminal: { Icon: TerminalIcon, color: "var(--violet)" },
  communication: { Icon: ChatIcon, color: "var(--s-done)" },
  other: { Icon: AppIcon, color: "var(--muted)" },
};

function AppTile({ category, size = 44 }: { category: Category; size?: number }) {
  const { Icon, color } = CATEGORY[category];
  return (
    <div
      className="grid shrink-0 place-items-center rounded-[14px] border"
      style={{
        width: size,
        height: size,
        color,
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.48)} />
    </div>
  );
}

function Stage({ label, state }: { label: string; state: "yes" | "no" | "stop" }) {
  const color = state === "yes" ? "var(--s-done)" : state === "stop" ? "var(--s-stuck)" : "var(--faint)";
  return (
    <li className="flex items-center gap-2 text-[12px]" style={{ color: state === "no" ? "var(--muted)" : "var(--text)" }}>
      <span className="grid h-4 w-4 shrink-0 place-items-center" style={{ color }}>
        {state === "yes" ? <CheckIcon size={14} /> : state === "stop" ? <CloseIcon size={13} /> : <span className="h-1.5 w-1.5 rounded-full border border-current" />}
      </span>
      {label}
    </li>
  );
}

interface Props {
  d: Dict;
  s: SessionState;
  status: Status | null;
  now: number;
  prefs: AwarenessPrefs | null;
  app: ActiveApp | null;
  recent: RecentApp[];
  awarenessFailed: boolean;
  onAwareness: (enabled: boolean, showTitles: boolean) => void;
  onNavigate: (v: View, anchor?: string) => void;
  onConnect: () => void;
}

export function HomeView({ d, s, status, now, prefs, app, recent, awarenessFailed, onAwareness, onNavigate, onConnect }: Props) {
  const t = d.home;
  const summary = buildSummary(s, status, now, d);
  const quick: { label: string; Icon: typeof AppIcon; go: () => void }[] = [
    { label: t.quick.claude, Icon: PulseIcon, go: () => onNavigate("live") },
    { label: t.quick.intel, Icon: ChatIcon, go: () => onNavigate("intel") },
    { label: t.quick.preview, Icon: GlobeIcon, go: () => onNavigate("live", "preview") },
    { label: t.quick.settings, Icon: GearIcon, go: () => onNavigate("settings") },
  ];

  return (
    <div className="space-y-3">
      <p className="px-1 text-[17px] font-semibold tracking-tight">{greeting(new Date(now).getHours(), d)}</p>

      {awarenessFailed && (
        <p className="px-1 text-xs text-[var(--s-error)]" role="alert">
          {t.failed}
        </p>
      )}

      {prefs && !prefs.asked && (
        <section className="hero rise p-4" data-status="working">
          <div className="flex items-center gap-2 text-[var(--cyan)]">
            <ShieldIcon size={17} />
            <h2 className="text-[15px] font-semibold text-[var(--text)]">{t.permission.title}</h2>
          </div>
          <p className="mt-1.5 text-[13px] leading-snug text-[var(--muted)]">{t.permission.body}</p>
          <ul className="mt-3 space-y-1.5">
            {t.permission.points.map((p) => (
              <li key={p} className="flex gap-2 text-[12.5px] leading-snug">
                <CheckIcon size={13} className="mt-0.5 shrink-0 text-[var(--s-done)]" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <Button variant="subtle" onClick={() => onAwareness(false, false)}>
              {t.permission.notNow}
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => onAwareness(true, false)}>
              {t.permission.allow}
            </Button>
          </div>
        </section>
      )}

      {prefs && prefs.asked && !prefs.enabled && (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[14px] font-medium">{t.off.title}</p>
              <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">{t.off.body}</p>
            </div>
            <Button variant="ghost" onClick={() => onAwareness(true, false)}>
              {t.off.turnOn}
            </Button>
          </div>
        </Card>
      )}

      {prefs?.enabled &&
        (app ? (
          <ActiveAppCard d={d} s={s} app={app} showTitles={prefs.showTitles} onAwareness={onAwareness} onNavigate={onNavigate} onConnect={onConnect} />
        ) : (
          <Card>
            <p className="shimmer text-[13px] text-[var(--muted)]">{t.detecting}</p>
          </Card>
        ))}

      {prefs?.enabled && <ZoneCard d={d} app={app} />}

      <Card>
        <div className="flex items-center gap-3">
          {s.monitor === "on" && <Orb status={status} size={46} />}
          <div className="min-w-0 flex-1">
            <Label>{t.summaryTitle}</Label>
            {s.monitor === "off" ? (
              <p className="mt-1 text-[13px] leading-snug text-[var(--muted)]">{t.claudeNotConnected}</p>
            ) : (
              <p className="mt-1 text-[13px] leading-snug">{summary.now}</p>
            )}
          </div>
        </div>
        {s.monitor !== "off" && (
          <div className="mt-2.5 space-y-1 border-t border-[var(--line)] pt-2.5 text-[12.5px] leading-snug text-[var(--muted)]">
            <p>{summary.done}</p>
            <p>{summary.next}</p>
          </div>
        )}
      </Card>

      {prefs?.enabled && (
        <Card>
          <Label>{t.recentTitle}</Label>
          {recent.length === 0 ? (
            <p className="mt-1.5 text-xs text-[var(--muted)]">{t.recentEmpty}</p>
          ) : (
            <ul className="mt-2.5 space-y-2">
              {recent.map((r, i) => (
                <li key={`${r.name}-${r.at}-${i}`} className="flex items-center gap-2.5 text-[12.5px]">
                  <span className="dot" style={{ color: CATEGORY[r.category].color }} />
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  <span className="shrink-0 font-mono text-[10.5px] text-[var(--faint)]">{ago(now - r.at, d.time)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div>
        <Label className="px-1">{t.quickTitle}</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {quick.map(({ label, Icon, go }) => (
            <button
              key={label}
              type="button"
              onClick={go}
              className="surface flex min-h-11 items-center gap-2.5 px-3 py-2.5 text-left text-[12.5px] font-medium transition-colors hover:border-[var(--line-strong)]"
            >
              <Icon size={16} className="shrink-0 text-[var(--cyan)]" />
              <span className="min-w-0 truncate">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActiveAppCard({
  d,
  s,
  app,
  showTitles,
  onAwareness,
  onNavigate,
  onConnect,
}: {
  d: Dict;
  s: SessionState;
  app: ActiveApp;
  showTitles: boolean;
  onAwareness: (enabled: boolean, showTitles: boolean) => void;
  onNavigate: (v: View, anchor?: string) => void;
  onConnect: () => void;
}) {
  const t = d.home;
  const ctx = appContext(app, s);
  const claudeKind = app.category === "coding" || app.category === "terminal";

  return (
    <section className="hero rise p-4" data-status={ctx.understood ? "working" : "idle"}>
      <div className="flex items-center gap-3">
        <AppTile category={app.category} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold tracking-tight" title={app.name} aria-live="polite">
            {app.name}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{t.categories[app.category]}</p>
        </div>
      </div>

      <p className="mt-3 text-[13.5px] leading-snug">{headline(app, d)}</p>
      <p className="mt-1 text-[12.5px] leading-snug text-[var(--muted)]">{contextLine(app, ctx, d)}</p>

      {showTitles ? (
        app.title && (
          <p className="selectable mt-2 truncate font-mono text-[11px] text-[var(--faint)]" title={app.title}>
            {app.title}
          </p>
        )
      ) : (
        <p className="mt-2 text-[11px] text-[var(--faint)]">{t.titleHidden}</p>
      )}

      <ul className="mt-3 space-y-1 border-t border-[var(--line)] pt-3">
        <Stage label={t.stages.detected} state="yes" />
        {ctx.unsupported ? (
          <Stage label={t.stages.unsupported} state="stop" />
        ) : (
          <>
            <Stage label={t.stages.context} state={ctx.contextAvailable ? "yes" : "no"} />
            <Stage label={t.stages.understood} state={ctx.understood ? "yes" : "no"} />
          </>
        )}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Chip color="var(--s-working)">
          <EyeIcon size={12} />
          {t.awarenessOn}
        </Chip>
        <button
          type="button"
          className="rounded-md px-1 text-[11px] text-[var(--muted)] hover:text-[var(--text)]"
          onClick={() => onAwareness(false, false)}
        >
          {t.pause}
        </button>
      </div>

      {claudeKind && s.monitor === "off" && (
        <Button variant="primary" className="mt-3 w-full" onClick={onConnect}>
          {t.hints.connect}
        </Button>
      )}
      {app.category === "browser" && (
        <Button variant="ghost" className="mt-3 w-full" onClick={() => onNavigate("live", "preview")}>
          {t.hints.preview}
        </Button>
      )}
      {app.category === "communication" && (
        <Button variant="ghost" className="mt-3 w-full" onClick={() => onNavigate("intel")}>
          {t.hints.paste}
        </Button>
      )}
    </section>
  );
}
