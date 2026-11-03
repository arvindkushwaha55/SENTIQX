import type { Dict } from "../lib/i18n";
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
      className="absolute inset-0 z-10 flex items-end bg-black/60 p-3 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <div className="rise max-h-full w-full overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <h2 id="consent-title" className="text-base font-semibold">
          {d.consent.title}
        </h2>
        <p className="mt-1 text-[13px] text-[var(--muted)]">{d.consent.intro}</p>

        <List items={d.consent.monitored} color="var(--s-working)" mark="+" />
        <List items={d.consent.notMonitored} color="var(--muted)" mark="-" />

        <p className="mt-3 text-xs text-[var(--muted)]">{d.consent.local}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{d.consent.external}</p>

        <div className="mt-4 flex gap-2">
          <Button onClick={onCancel}>{d.consent.cancel}</Button>
          <Button variant="primary" onClick={onAllow}>
            {d.consent.allow}
          </Button>
        </div>
      </div>
    </div>
  );
}

function List({ items, color, mark }: { items: string[]; color: string; mark: string }) {
  return (
    <ul className="mt-3 space-y-1.5">
      {items.map((t) => (
        <li key={t} className="flex gap-2 text-[13px] leading-snug">
          <span className="w-3 shrink-0 text-center font-mono" style={{ color }} aria-hidden="true">
            {mark}
          </span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
