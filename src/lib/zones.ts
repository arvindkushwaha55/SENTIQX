import type { Category } from "./appContext";

/**
 * Workspace Zone Awareness — pure geometry.
 *
 * SENTIQX divides the current monitor's work area into 2 halves or 4 quadrants
 * ("zones"). The Rust watcher reports every real application window with its
 * bounds; this module decides which zone SENTIQX itself sits in and which app
 * occupies each zone. It never guesses: when two windows cover a zone almost
 * equally, the zone is reported as ambiguous instead of picking one.
 *
 * All rectangles are physical screen pixels, matching Win32 `GetWindowRect`
 * and Tauri's `outerPosition` / monitor `workArea`.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One real application window with its bounds, from the `zone-windows` event. */
export interface ZoneWindow {
  exe: string;
  name: string;
  category: Category;
  title: string | null;
  pid: number;
  rect: Rect;
}

export type ZoneLayout = 2 | 4;

export interface Zone {
  id: "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  rect: Rect;
}

export interface ZoneOccupant {
  zone: Zone;
  /** The app occupying this zone, or null when there is no clear occupant. */
  window: ZoneWindow | null;
  /** True when two windows cover the zone almost equally — shown honestly, never guessed. */
  ambiguous: boolean;
  /** How much of the zone the occupant covers, 0..1. */
  coverage: number;
}

/** A window must cover at least this much of a zone to count as its occupant. */
export const MIN_COVERAGE = 0.25;
/** If the runner-up is within this distance of the best coverage, the zone is ambiguous. */
export const AMBIGUITY_GAP = 0.1;

export function zoneGrid(workArea: Rect, layout: ZoneLayout): Zone[] {
  const { x, y, w, h } = workArea;
  if (w <= 0 || h <= 0) return [];
  const hw = Math.floor(w / 2);
  if (layout === 2) {
    return [
      { id: "left", rect: { x, y, w: hw, h } },
      { id: "right", rect: { x: x + hw, y, w: w - hw, h } },
    ];
  }
  const hh = Math.floor(h / 2);
  return [
    { id: "top-left", rect: { x, y, w: hw, h: hh } },
    { id: "top-right", rect: { x: x + hw, y, w: w - hw, h: hh } },
    { id: "bottom-left", rect: { x, y: y + hh, w: hw, h: h - hh } },
    { id: "bottom-right", rect: { x: x + hw, y: y + hh, w: w - hw, h: h - hh } },
  ];
}

export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function area(r: Rect): number {
  return Math.max(0, r.w) * Math.max(0, r.h);
}

/** The zone containing a point, or null when the point is outside every zone. */
export function zoneAtPoint(zones: Zone[], px: number, py: number): Zone | null {
  for (const z of zones) {
    const r = z.rect;
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return z;
  }
  return null;
}

/** SENTIQX's own zone is where the centre of its window falls. Null when it sits
 *  on another monitor (its centre is outside this monitor's zones). */
export function ownZone(zones: Zone[], own: Rect): Zone | null {
  return zoneAtPoint(zones, own.x + own.w / 2, own.y + own.h / 2);
}

export function occupantForZone(zone: Zone, windows: ZoneWindow[]): ZoneOccupant {
  const zoneArea = area(zone.rect);
  if (zoneArea <= 0) return { zone, window: null, ambiguous: false, coverage: 0 };
  let best: ZoneWindow | null = null;
  let bestCov = 0;
  let secondCov = 0;
  for (const win of windows) {
    const cov = overlapArea(zone.rect, win.rect) / zoneArea;
    if (cov > bestCov) {
      secondCov = bestCov;
      bestCov = cov;
      best = win;
    } else if (cov > secondCov) {
      secondCov = cov;
    }
  }
  if (!best || bestCov < MIN_COVERAGE) {
    return { zone, window: null, ambiguous: false, coverage: bestCov };
  }
  if (secondCov >= MIN_COVERAGE && bestCov - secondCov < AMBIGUITY_GAP) {
    return { zone, window: null, ambiguous: true, coverage: bestCov };
  }
  return { zone, window: best, ambiguous: false, coverage: bestCov };
}

export interface ZoneSummary {
  zones: Zone[];
  occupants: ZoneOccupant[];
  /** The zone SENTIQX itself is placed in, or null if its centre is off this monitor. */
  own: Zone | null;
  /** The occupant of SENTIQX's own zone (matches `own` in `occupants`). */
  ownOccupant: ZoneOccupant | null;
  /**
   * True when the same single window occupies every zone (e.g. one maximised
   * app) — there is no real split, so the normal active-window context applies.
   */
  unsplit: boolean;
}

export function summarizeZones(
  workArea: Rect,
  layout: ZoneLayout,
  windows: ZoneWindow[],
  own: Rect,
): ZoneSummary {
  const zones = zoneGrid(workArea, layout);
  const occupants = zones.map((z) => occupantForZone(z, windows));
  const mine = ownZone(zones, own);
  const ownOccupant = mine ? (occupants.find((o) => o.zone.id === mine.id) ?? null) : null;
  const first = occupants[0]?.window;
  const unsplit =
    occupants.length > 0 &&
    !!first &&
    occupants.every((o) => o.window !== null && o.window.pid === first.pid && o.window.rect === first.rect);
  return { zones, occupants, own: mine, ownOccupant, unsplit };
}
