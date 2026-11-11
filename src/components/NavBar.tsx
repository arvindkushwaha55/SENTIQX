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
    <nav className="grid shrink-0 grid-cols-7 gap-0.5 border-t border-[var(--line)] bg-[rgba(5,7,11,0.6)] px-1 py-1.5" aria-label="Main">
      {ITEMS.map(({ id, Icon }) => {
        const active = view === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-w-0 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition-colors ${
              active ? "text-[var(--cyan)]" : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {active && (
              <span className="absolute -top-1.5 h-[2px] w-7 rounded-full bg-[var(--cyan)] shadow-[0_0_10px_var(--cyan)]" />
            )}
            <span className="relative">
              <Icon size={17} />
              {dot === id && !active && (
                <span className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--s-waiting)]" aria-hidden="true" />
              )}
            </span>
            <span className="max-w-full truncate">{d.nav[id]}</span>
          </button>
        );
      })}
    </nav>
  );
}
