import type { Dict } from "../lib/i18n";
import { ChatIcon, GearIcon, HistoryIcon, HomeIcon, PulseIcon } from "./icons";

export type View = "home" | "live" | "intel" | "history" | "settings";

const ITEMS: { id: View; Icon: typeof PulseIcon }[] = [
  { id: "home", Icon: HomeIcon },
  { id: "live", Icon: PulseIcon },
  { id: "intel", Icon: ChatIcon },
  { id: "history", Icon: HistoryIcon },
  { id: "settings", Icon: GearIcon },
];

export function NavBar({ d, view, onChange }: { d: Dict; view: View; onChange: (v: View) => void }) {
  return (
    <nav className="grid shrink-0 grid-cols-5 gap-0.5 border-t border-[var(--line)] bg-[rgba(5,7,11,0.6)] px-1.5 py-1.5" aria-label="Main">
      {ITEMS.map(({ id, Icon }) => {
        const active = view === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-w-0 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-medium transition-colors ${
              active ? "text-[var(--cyan)]" : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {active && (
              <span className="absolute -top-1.5 h-[2px] w-7 rounded-full bg-[var(--cyan)] shadow-[0_0_10px_var(--cyan)]" />
            )}
            <Icon size={17} />
            <span className="truncate">{d.nav[id]}</span>
          </button>
        );
      })}
    </nav>
  );
}
