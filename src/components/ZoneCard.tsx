import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import type { ActiveApp } from "../lib/appContext";
import { useZoneWindows } from "../lib/awareness";
import type { Dict } from "../lib/i18n";
import { type Rect, type ZoneLayout, type ZoneOccupant, summarizeZones } from "../lib/zones";
import { Button, Card, Label } from "./ui";

const PREF_KEY = "sentiqx.zones";

interface ZonePrefs {
  on: boolean;
  layout: ZoneLayout;
}

function loadPrefs(): ZonePrefs {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<ZonePrefs>;
      return { on: p.on === true, layout: p.layout === 4 ? 4 : 2 };
    }
  } catch {
    /* unreadable prefs fall back to off */
  }
  return { on: false, layout: 2 };
}

interface Geometry {
  workArea: Rect;
  own: Rect;
}

/** SENTIQX's own bounds and its monitor's work area, in physical pixels —
 *  the same units as the watcher's window rectangles. Polled once a second,
 *  which also picks up monitor changes. */
function useGeometry(active: boolean): Geometry | null {
  const [geo, setGeo] = useState<Geometry | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const read = async () => {
      try {
        const win = getCurrentWindow();
        const [pos, size, monitor] = await Promise.all([win.outerPosition(), win.outerSize(), currentMonitor()]);
        if (cancelled || !monitor) return;
        const next: Geometry = {
          workArea: {
            x: monitor.workArea.position.x,
            y: monitor.workArea.position.y,
            w: monitor.workArea.size.width,
            h: monitor.workArea.size.height,
          },
          own: { x: pos.x, y: pos.y, w: size.width, h: size.height },
        };
        setGeo((prev) =>
          prev &&
          prev.workArea.x === next.workArea.x &&
          prev.workArea.y === next.workArea.y &&
          prev.workArea.w === next.workArea.w &&
          prev.workArea.h === next.workArea.h &&
          prev.own.x === next.own.x &&
          prev.own.y === next.own.y &&
          prev.own.w === next.own.w &&
          prev.own.h === next.own.h
            ? prev
            : next,
        );
      } catch {
        /* not running inside Tauri (or no monitor yet): keep the last reading */
      }
    };
    void read();
    const id = setInterval(read, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active]);

  return geo;
}

const CATEGORY_COLOR: Record<ActiveApp["category"], string> = {
  coding: "var(--cyan)",
  browser: "var(--blue)",
  terminal: "var(--violet)",
  communication: "var(--s-done)",
  other: "var(--muted)",
};

function ZoneCell({
  occ,
  mine,
  isActive,
  d,
}: {
  occ: ZoneOccupant;
  mine: boolean;
  isActive: boolean;
  d: Dict;
}) {
  const t = d.home.zones;
  const win = occ.window;
  return (
    <div
      className="rounded-[10px] border px-2.5 py-2"
      style={{
        borderColor: mine ? "var(--cyan)" : "var(--line)",
        background: mine ? "color-mix(in srgb, var(--cyan) 7%, transparent)" : "transparent",
      }}
    >
      <p className="flex items-center justify-between gap-1 text-[10px] font-medium tracking-wide text-[var(--faint)] uppercase">
        <span>{t.names[occ.zone.id]}</span>
        {isActive && win && <span style={{ color: "var(--s-working)" }}>{t.active}</span>}
      </p>
      {win ? (
        <p className="mt-1 flex items-center gap-1.5 truncate text-[12.5px] font-medium" title={win.name}>
          <span className="dot shrink-0" style={{ color: CATEGORY_COLOR[win.category] }} />
          <span className="truncate">{win.name}</span>
        </p>
      ) : (
        <p className="mt-1 text-[11.5px] leading-snug text-[var(--muted)]">{occ.ambiguous ? t.ambiguous : t.empty}</p>
      )}
    </div>
  );
}

/**
 * Workspace Zone Awareness (Phase Z1): which app sits in the screen zone where
 * SENTIQX itself is placed. Opt-in, on top of the awareness permission — the
 * zone data only exists while app detection is on.
 */
export function ZoneCard({ d, app }: { d: Dict; app: ActiveApp | null }) {
  const t = d.home.zones;
  const [prefs, setPrefs] = useState<ZonePrefs>(loadPrefs);
  const windows = useZoneWindows();
  const geo = useGeometry(prefs.on);

  const save = (next: ZonePrefs) => {
    setPrefs(next);
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: the choice lasts for this session only */
    }
  };

  if (!prefs.on) {
    return (
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14px] font-medium">{t.title}</p>
            <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">{t.body}</p>
          </div>
          <Button variant="ghost" onClick={() => save({ ...prefs, on: true })}>
            {t.turnOn}
          </Button>
        </div>
      </Card>
    );
  }

  const summary = geo ? summarizeZones(geo.workArea, prefs.layout, windows, geo.own) : null;

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <Label>{t.title}</Label>
        <div className="flex items-center gap-1">
          {([2, 4] as ZoneLayout[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => save({ ...prefs, layout: l })}
              className="rounded-md px-1.5 py-0.5 text-[11px]"
              style={{
                color: prefs.layout === l ? "var(--text)" : "var(--faint)",
                background: prefs.layout === l ? "var(--line)" : "transparent",
              }}
            >
              {l === 2 ? t.layout2 : t.layout4}
            </button>
          ))}
          <button
            type="button"
            className="rounded-md px-1 text-[11px] text-[var(--muted)] hover:text-[var(--text)]"
            onClick={() => save({ ...prefs, on: false })}
          >
            {t.turnOff}
          </button>
        </div>
      </div>

      {!summary ? (
        <p className="shimmer mt-2 text-[13px] text-[var(--muted)]">{t.detecting}</p>
      ) : !summary.own ? (
        <p className="mt-2 text-[13px] leading-snug text-[var(--muted)]">{t.otherScreen}</p>
      ) : (
        <>
          <p className="mt-2 text-[13.5px] leading-snug font-medium">{t.youAreIn(t.names[summary.own.id])}</p>
          {summary.ownOccupant?.window ? (
            <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--muted)]">
              {t.occupant(summary.ownOccupant.window.name)}
            </p>
          ) : (
            <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--muted)]">
              {summary.ownOccupant?.ambiguous ? t.ambiguous : t.empty}
            </p>
          )}
          {summary.unsplit && <p className="mt-1 text-[11.5px] text-[var(--faint)]">{t.unsplit}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {summary.occupants.map((occ) => (
              <ZoneCell
                key={occ.zone.id}
                occ={occ}
                mine={summary.own?.id === occ.zone.id}
                isActive={!!app && !!occ.window && occ.window.pid === app.pid}
                d={d}
              />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
