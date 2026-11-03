import type { Dict } from "../lib/i18n";
import type { Language } from "../lib/types";
import { Card, Label, Pill } from "./ui";

export function SettingsView({
  d,
  lang,
  setLang,
  pinned,
  togglePin,
}: {
  d: Dict;
  lang: Language;
  setLang: (l: Language) => void;
  pinned: boolean;
  togglePin: () => void;
}) {
  return (
    <div className="space-y-3">
      <Card>
        <Label>{d.settings.language}</Label>
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-[var(--bg)] p-1" role="radiogroup" aria-label={d.settings.language}>
          <Seg active={lang === "en"} onClick={() => setLang("en")}>
            {d.settings.english}
          </Seg>
          <Seg active={lang === "hinglish"} onClick={() => setLang("hinglish")}>
            {d.settings.hinglish}
          </Seg>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">{d.settings.languageHint}</p>
      </Card>

      <Card>
        <Label>{d.settings.window}</Label>
        <div className="mt-2">
          <Pill onClick={togglePin} active={pinned} title={pinned ? d.pin.onHint : d.pin.offHint}>
            {pinned ? d.pin.on : d.pin.off}
          </Pill>
        </div>
      </Card>

      <Card>
        <Label>{d.settings.privacy}</Label>
        <p className="mt-2 text-[13px] leading-snug">{d.settings.local}</p>
        <p className="mt-1.5 text-[13px] leading-snug">{d.settings.external}</p>
        <p className="mt-1.5 text-xs text-[var(--muted)]">{d.settings.noExternalYet}</p>
      </Card>
    </div>
  );
}

function Seg({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
        active ? "bg-[var(--panel-2)] text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}

export function HistoryView({ d }: { d: Dict }) {
  return (
    <Card>
      <p className="text-[13px]">{d.history.empty}</p>
      <p className="mt-1.5 text-xs text-[var(--muted)]">{d.history.note}</p>
    </Card>
  );
}
