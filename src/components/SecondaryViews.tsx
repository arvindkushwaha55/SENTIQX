import { useState } from "react";
import type { AwarenessPrefs } from "../lib/awareness";
import type { Dict } from "../lib/i18n";
import type { Language } from "../lib/types";
import { HistoryIcon, PinIcon } from "./icons";
import { Button, Card, Empty, Label } from "./ui";

export function SettingsView({
  d,
  lang,
  setLang,
  pinned,
  togglePin,
  awareness,
  onAwareness,
  filter,
  filterError,
  onFilter,
}: {
  d: Dict;
  lang: Language;
  setLang: (l: Language) => void;
  pinned: boolean;
  togglePin: () => void;
  awareness: AwarenessPrefs | null;
  onAwareness: (enabled: boolean, showTitles: boolean) => void;
  filter: string;
  filterError: string | null;
  onFilter: (folder: string) => void;
}) {
  const t = d.settings;
  const [draft, setDraft] = useState(filter);
  const enabled = Boolean(awareness?.enabled);
  const titles = Boolean(awareness?.showTitles);

  return (
    <div className="space-y-3">
      <h2 className="px-1 text-[17px] font-semibold tracking-tight">{t.title}</h2>

      <Card>
        <Label>{t.language}</Label>
        <div
          className="mt-2 grid grid-cols-2 gap-1 rounded-xl border border-[var(--line)] bg-[var(--bg0)] p-1"
          role="radiogroup"
          aria-label={t.language}
        >
          <Seg active={lang === "en"} onClick={() => setLang("en")}>
            {t.english}
          </Seg>
          <Seg active={lang === "hinglish"} onClick={() => setLang("hinglish")}>
            {t.hinglish}
          </Seg>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">{t.languageHint}</p>
      </Card>

      <Card>
        <Label>{t.awareness}</Label>
        <div className="mt-2.5 space-y-3">
          <Toggle
            id="set-awareness"
            label={t.awarenessToggle}
            hint={t.awarenessHint}
            checked={enabled}
            disabled={awareness === null}
            onChange={(v) => onAwareness(v, v && titles)}
          />
          <Toggle
            id="set-titles"
            label={t.titlesToggle}
            hint={t.titlesHint}
            checked={titles}
            disabled={!enabled}
            onChange={(v) => onAwareness(true, v)}
          />
        </div>
      </Card>

      <Card>
        <Label>{t.window}</Label>
        <div className="mt-2.5">
          <Button variant={pinned ? "ghost" : "subtle"} onClick={togglePin}>
            <PinIcon size={14} filled={pinned} />
            {pinned ? d.win.pinnedState : d.win.unpinnedState}
          </Button>
        </div>
        <p className="mt-2.5 text-xs leading-relaxed text-[var(--muted)]">{t.windowHint}</p>
      </Card>

      <Card>
        <label htmlFor="set-filter">
          <Label>{t.filter}</Label>
        </label>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">{t.filterHint}</p>
        <form
          className="mt-2.5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onFilter(draft);
          }}
        >
          <input
            id="set-filter"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.filterPlaceholder}
            spellCheck={false}
            className="min-w-0 flex-1 rounded-xl border border-[var(--line-strong)] bg-[var(--bg0)] px-3 py-2 font-mono text-[12px] text-[var(--text)] placeholder:text-[var(--faint)]"
          />
          <Button variant="ghost" onClick={() => onFilter(draft)} disabled={!draft.trim()}>
            {t.filterApply}
          </Button>
        </form>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <p className="min-w-0 break-words text-[var(--muted)]">{filter ? t.filterActive(filter) : t.filterAll}</p>
          {filter && (
            <button
              type="button"
              className="shrink-0 text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => {
                setDraft("");
                onFilter("");
              }}
            >
              {t.filterClear}
            </button>
          )}
        </div>
        {filterError && (
          <p className="mt-2 break-words text-xs text-[var(--s-error)]" role="alert">
            {t.filterError(filterError)}
          </p>
        )}
      </Card>

      <Card>
        <Label>{t.privacy}</Label>
        <p className="mt-2 text-[13px] leading-snug">{t.local}</p>
        <p className="mt-1.5 text-[13px] leading-snug">{t.external}</p>
        <p className="mt-1.5 text-xs text-[var(--muted)]">{t.noExternalYet}</p>
      </Card>

      <Card>
        <Label>{t.about}</Label>
        <p className="mt-2 font-mono text-[12px] text-[var(--muted)]">{t.aboutText}</p>
      </Card>
    </div>
  );
}

function Toggle({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 ${disabled ? "opacity-50" : ""}`}>
      <label htmlFor={id} className="min-w-0">
        <span className="text-[13px] leading-snug">{label}</span>
        <span className="mt-0.5 block text-xs leading-snug text-[var(--muted)]">{hint}</span>
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors ${
          checked ? "border-[var(--cyan)] bg-[rgba(94,231,255,0.25)]" : "border-[var(--line-strong)] bg-[var(--bg0)]"
        }`}
      >
        <span
          className={`absolute top-[2px] h-3.5 w-3.5 rounded-full transition-all ${
            checked ? "left-[18px] bg-[var(--cyan)]" : "left-[2px] bg-[var(--muted)]"
          }`}
        />
      </button>
    </div>
  );
}

function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
        active
          ? "bg-gradient-to-r from-[rgba(94,231,255,0.18)] to-[rgba(155,123,255,0.18)] text-[var(--text)] shadow-[inset_0_0_0_1px_rgba(94,231,255,0.35)]"
          : "text-[var(--muted)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}

export function HistoryView({ d }: { d: Dict }) {
  return (
    <div className="space-y-3">
      <h2 className="px-1 text-[17px] font-semibold tracking-tight">{d.history.title}</h2>
      <Card>
        <Empty icon={<HistoryIcon size={22} />} title={d.history.empty} note={d.history.note} />
      </Card>
    </div>
  );
}
