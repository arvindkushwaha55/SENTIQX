# Workspace Zone Awareness (Phase Z1)

SENTIQX already knew which application is in front. Zone Awareness adds *where*
things are: it divides the current monitor's work area into 2 halves or
4 quadrants and shows which app sits in the zone where SENTIQX itself is placed.

## How it works

- The existing awareness watcher (0.7 s poll, only while app detection is on)
  now also enumerates **every** real application window with its bounds
  (`EnumWindows` + `GetWindowRect`, physical pixels) and emits them as a
  `zone-windows` event whenever the set changes. SENTIQX's own windows are
  excluded.
- The Home card is opt-in (its own toggle, stored locally) with a 2-zone /
  4-zone choice. SENTIQX's zone is decided by the **centre point** of its own
  window against its monitor's work area (Tauri window/monitor APIs, same
  physical pixels).
- A zone's occupant is the window covering the largest share of that zone
  (`src/lib/zones.ts`, pure functions, unit-tested):
  - A window must cover at least **25%** of a zone to count as its occupant.
  - If two windows cover a zone almost equally (within 10%), the zone is shown
    as **not clear** — SENTIQX never guesses.
  - If the same single window occupies every zone, the card says there is **no
    split** and the normal active-window context stays in charge.
- The mini grid shows every zone at once (the seed of the proposed Multi-Window
  Mini Dashboard): SENTIQX's own zone is outlined, and the zone containing the
  active app carries an "Active" marker.

## Privacy

- Zone data exists only while the existing app-detection permission is on, and
  the card has its own off switch on top of that.
- Only window rectangles and the same name/category the app already shows are
  used. Rectangles are never stored and never leave the machine. Window titles
  appear only under the existing titles permission, exactly as before.
- Nothing about a window's *content* is read — a zone says where an app sits,
  never what is inside it.

## Honest limits (Z1)

- **One monitor.** Zones are computed for the monitor SENTIQX is on. If its
  centre is on another screen, the card says so instead of guessing; windows on
  other monitors are not mapped.
- **Geometry is inferred, not snapped-state.** Windows 11 snap layouts and
  PowerToys FancyZones expose no public query API, so zones come from window
  rectangles alone. Overlapping or floating windows can make a zone "not clear".
- **Minimised windows disappear** (the real-window filter excludes them), so
  their zone reads as empty until they are restored.
- **No per-zone Claude status.** The card shows the app in each zone, not a
  live Claude session per zone — hook events carry a project folder, not which
  window a session lives in.
- **Not yet verified in a real Windows build.** The geometry maths is
  unit-tested and the frontend builds clean; the Rust window enumeration with
  bounds follows the existing verified watcher patterns but has not yet run on
  a real Windows desktop.
