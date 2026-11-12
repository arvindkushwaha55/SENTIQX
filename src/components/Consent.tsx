import type { Dict } from "../lib/i18n";
import { CheckIcon, CloseIcon, ShieldIcon } from "./icons";
import { Button } from "./ui";

export function Consent({
  d,
  onAllow,
  onCancel,
}: {
  d: Dict;
  onAllow: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-10 flex items-end bg-[var(--overlay)] p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <div className="surface rise max-h-full w-full overflow-y-auto !border-[var(--line-strong)] !bg-[var(--bg1)] p-4">
        <div className="flex items-center gap-2 text-[var(--cyan)]">
          <ShieldIcon size={18} />
          <h2 id="consent-title" className="display text-[16px] font-semibold text-[var(--text)]">
            {d.consent.title}
          </h2>
        </div>
        <p className="mt-1.5 text-[13px] text-[var(--muted)]">{d.consent.intro}</p>

        <List items={d.consent.monitored} ok />
        <List items={d.consent.notMonitored} />

        <p className="mt-3 text-xs leading-relaxed text-[var(--text)]/90">{d.consent.changes}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">{d.consent.local}</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{d.consent.external}</p>

        <div className="mt-4 flex gap-2">
          <Button variant="subtle" onClick={onCancel}>
            {d.consent.cancel}
          </Button>
          <Button variant="primary" className="flex-1" onClick={onAllow}>
            {d.consent.allow}
          </Button>
        </div>
      </div>
    </div>
  );
}

function List({ items, ok }: { items: string[]; ok?: boolean }) {
  return (
    <ul className="mt-3 space-y-1.5">
      {items.map((t) => (
        <li key={t} className="flex gap-2 text-[13px] leading-snug">
          <span className={`mt-0.5 shrink-0 ${ok ? "text-[var(--s-done)]" : "text-[var(--faint)]"}`}>
            {ok ? <CheckIcon size={14} /> : <CloseIcon size={14} />}
          </span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
