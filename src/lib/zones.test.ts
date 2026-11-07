import { describe, expect, it } from "vitest";
import {
  type Rect,
  type ZoneWindow,
  occupantForZone,
  overlapArea,
  ownZone,
  summarizeZones,
  zoneAtPoint,
  zoneGrid,
} from "./zones";

const WORK: Rect = { x: 0, y: 0, w: 1920, h: 1040 }; // 1080p minus taskbar

function win(name: string, rect: Rect, pid: number): ZoneWindow {
  return { exe: name, name, category: "other", title: null, pid, rect };
}

describe("zoneGrid", () => {
  it("splits the work area into two halves", () => {
    const zones = zoneGrid(WORK, 2);
    expect(zones.map((z) => z.id)).toEqual(["left", "right"]);
    expect(zones[0].rect).toEqual({ x: 0, y: 0, w: 960, h: 1040 });
    expect(zones[1].rect).toEqual({ x: 960, y: 0, w: 960, h: 1040 });
  });

  it("splits into four quadrants, keeping an odd width whole", () => {
    const zones = zoneGrid({ x: 0, y: 0, w: 1919, h: 1040 }, 4);
    expect(zones.map((z) => z.id)).toEqual(["top-left", "top-right", "bottom-left", "bottom-right"]);
    expect(zones[0].rect.w + zones[1].rect.w).toBe(1919);
    expect(zones[2].rect.y).toBe(520);
  });

  it("respects a work area offset (taskbar / second origin)", () => {
    const zones = zoneGrid({ x: 1920, y: 40, w: 1280, h: 1000 }, 2);
    expect(zones[0].rect).toEqual({ x: 1920, y: 40, w: 640, h: 1000 });
    expect(zones[1].rect.x).toBe(2560);
  });

  it("returns no zones for an empty work area", () => {
    expect(zoneGrid({ x: 0, y: 0, w: 0, h: 0 }, 2)).toEqual([]);
  });
});

describe("overlapArea", () => {
  it("is zero for disjoint rectangles", () => {
    expect(overlapArea({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 })).toBe(0);
  });

  it("counts a partial overlap", () => {
    expect(overlapArea({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(25);
  });

  it("counts a fully contained rectangle in full", () => {
    expect(overlapArea({ x: 0, y: 0, w: 100, h: 100 }, { x: 10, y: 10, w: 20, h: 20 })).toBe(400);
  });
});

describe("ownZone", () => {
  const zones = zoneGrid(WORK, 2);

  it("uses the centre of SENTIQX's own window", () => {
    expect(ownZone(zones, { x: 100, y: 100, w: 420, h: 720 })?.id).toBe("left");
    expect(ownZone(zones, { x: 1400, y: 100, w: 420, h: 720 })?.id).toBe("right");
  });

  it("a window straddling the middle follows its centre", () => {
    // Spans both halves, but its centre (1160) is in the right half.
    expect(ownZone(zones, { x: 750, y: 0, w: 820, h: 720 })?.id).toBe("right");
  });

  it("is null when SENTIQX sits on another monitor", () => {
    expect(ownZone(zones, { x: -1500, y: 100, w: 420, h: 720 })).toBeNull();
  });

  it("zoneAtPoint matches quadrants", () => {
    const q = zoneGrid(WORK, 4);
    expect(zoneAtPoint(q, 100, 900)?.id).toBe("bottom-left");
    expect(zoneAtPoint(q, 5000, 100)).toBeNull();
  });
});

describe("occupantForZone", () => {
  const [left] = zoneGrid(WORK, 2);

  it("picks the window covering most of the zone", () => {
    const code = win("VS Code", { x: 0, y: 0, w: 960, h: 1040 }, 1);
    const note = win("Notepad", { x: 100, y: 100, w: 300, h: 300 }, 2);
    const occ = occupantForZone(left, [note, code]);
    expect(occ.window?.name).toBe("VS Code");
    expect(occ.coverage).toBeCloseTo(1);
    expect(occ.ambiguous).toBe(false);
  });

  it("reports ambiguous instead of guessing when two windows share a zone", () => {
    const a = win("A", { x: 0, y: 0, w: 700, h: 1040 }, 1); // ~73% of the zone
    const b = win("B", { x: 200, y: 0, w: 700, h: 1040 }, 2); // ~66% of the zone
    const occ = occupantForZone(left, [a, b]);
    expect(occ.window).toBeNull();
    expect(occ.ambiguous).toBe(true);
  });

  it("a clear winner over a smaller overlap is not ambiguous", () => {
    const a = win("A", { x: 0, y: 0, w: 960, h: 1040 }, 1); // 100%
    const b = win("B", { x: 0, y: 0, w: 500, h: 1040 }, 2); // ~52%
    const occ = occupantForZone(left, [a, b]);
    expect(occ.window?.name).toBe("A");
    expect(occ.ambiguous).toBe(false);
  });

  it("a small floating window does not occupy a zone", () => {
    const tiny = win("Calc", { x: 10, y: 10, w: 200, h: 200 }, 3); // ~4% of the zone
    const occ = occupantForZone(left, [tiny]);
    expect(occ.window).toBeNull();
    expect(occ.ambiguous).toBe(false);
  });

  it("an empty zone has no occupant", () => {
    const occ = occupantForZone(left, []);
    expect(occ.window).toBeNull();
    expect(occ.coverage).toBe(0);
  });
});

describe("summarizeZones", () => {
  it("finds SENTIQX's zone and its occupant in a real split", () => {
    const code = win("VS Code", { x: 0, y: 0, w: 960, h: 1040 }, 1);
    const chrome = win("Chrome", { x: 960, y: 0, w: 960, h: 1040 }, 2);
    const s = summarizeZones(WORK, 2, [code, chrome], { x: 100, y: 50, w: 420, h: 720 });
    expect(s.own?.id).toBe("left");
    expect(s.ownOccupant?.window?.name).toBe("VS Code");
    expect(s.unsplit).toBe(false);
  });

  it("one maximised window in every zone means no split", () => {
    const max = win("Chrome", { x: 0, y: 0, w: 1920, h: 1040 }, 2);
    const s = summarizeZones(WORK, 2, [max], { x: 100, y: 50, w: 420, h: 720 });
    expect(s.unsplit).toBe(true);
    expect(s.ownOccupant?.window?.name).toBe("Chrome");
  });

  it("a second clear window breaks the unsplit reading", () => {
    const max = win("Chrome", { x: 0, y: 0, w: 1920, h: 1040 }, 2);
    const code = win("VS Code", { x: 0, y: 0, w: 960, h: 1040 }, 1);
    // Left zone is ambiguous (max ~100% vs code 100%) — not a single clear occupant.
    const s = summarizeZones(WORK, 2, [code, max], { x: 100, y: 50, w: 420, h: 720 });
    expect(s.unsplit).toBe(false);
  });
});
