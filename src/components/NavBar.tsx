import type { Dict } from "../lib/i18n";
import { BugIcon, ChatIcon, GearIcon, HistoryIcon, HomeIcon, PulseIcon, ShieldIcon } from "./icons";

export type View = "home" | "live" | "debug" | "intel" | "guard" | "history" | "settings";

const ITEMS: { id: View; Icon: typeof PulseIcon }[] = [
  { id: "home", Icon: HomeIcon },
  { id: "live", Icon: PulseIcon },
  { id: "debug", Icon: BugIcon },
  { id: "intel", Icon: ChatIcon },
  { id: "guard", Icon: ShieldIcon },
  { id: "history", Icon: HistoryIcon },
  { id: "settings", Icon: GearIcon },
];

/** Floating circular dock, centred at the bottom of the window. */
export function NavBar({
  d,
  view,
  onChange,
  dot,
}: {
  d: Dict;
  view: View;
  onChange: (v: View) => void;
  /** A tab with something new. It only shows a dot and never pulls focus. */
  dot?: View | null;
}) {
  return (
    <nav className="flex shrink-0 justify-center pb-2.5 pt-1.5" aria-label="Main">
      <div className="flex items-start gap-1 sm:gap-1.5">
        {ITEMS.map(({ id, Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={active ? "page" : undefined}
              className="group flex w-[50px] flex-col items-center gap-1"
            >
              <span
                className={`relative grid h-10 w-10 place-items-center rounded-full border shadow-[0_6px_16px_var(--shadow)] transition-colors ${
                  active
                    ? "dock-on border-[var(--orange)] bg-[var(--tint-orange)] text-[var(--orange)]"
                    : "border-[var(--line)] bg-[var(--dock-bg)] text-[var(--muted)] group-hover:text-[var(--text)]"
                }`}
              >
                <Icon size={17} />
                {dot === id && !active && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--s-waiting)]" aria-hidden="true" />
                )}
              </span>
              <span
                className={`max-w-full truncate text-[9px] ${
                  active ? "font-semibold text-[var(--text)]" : "text-[var(--faint)]"
                }`}
              >
                {d.nav[id]}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
