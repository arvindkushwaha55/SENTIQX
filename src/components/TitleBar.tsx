import { useEffect, useState } from "react";
import type { Dict } from "../lib/i18n";
import type { Language, Theme } from "../lib/types";
import { closeWindow, hideWindow } from "../lib/windowControls";
import type { View } from "./NavBar";
import { CheckIcon, ChevronIcon, CloseIcon, LogoMark, MinusIcon, PinIcon } from "./icons";

export type InfoKind = "privacy" | "terms" | "about";

/**
 * Custom title bar for the frameless window. The empty area is a native drag region
 * (Tauri `data-tauri-drag-region`), so moving the window is handled by Windows itself.
 * The brand pill on the left opens the app menu: language, privacy, terms, about, settings.
 */
export function TitleBar({
  d,
  pinned,
  onTogglePin,
  pinFailed,
  lang,
  onLang,
  theme,
  onTheme,
  onNavigate,
  onInfo,
}: {
  d: Dict;
  pinned: boolean;
  onTogglePin: () => void;
  pinFailed: boolean;
  lang: Language;
  onLang: (l: Language) => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
  onNavigate: (v: View) => void;
  onInfo: (k: InfoKind) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);
  const item =
    "flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-[12.5px] text-[var(--text)] transition-colors hover:bg-[var(--tint-cyan)]";

  return (
    <header
      data-tauri-drag-region
      className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line)] pl-3 pr-2"
    >
      <div className="relative">
        <button
          type="button"
          className="brandpill"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <LogoMark size={17} />
          <span className="display text-[11.5px] font-semibold tracking-[0.24em]">SENTIQX</span>
          <ChevronIcon size={13} className="text-[var(--muted)]" />
        </button>
        {open && (
          <>
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              className="fixed inset-0 z-20 cursor-default"
              onClick={() => setOpen(false)}
            />
            <div className="menupanel rise" role="menu" aria-label={d.menu.about}>
              <p className="label px-3.5 pb-1 pt-3">{d.menu.language}</p>
              <button type="button" className={item} role="menuitem" onClick={() => onLang("en")}>
                <span>English</span>
                {lang === "en" && <CheckIcon size={14} className="text-[var(--cyan)]" />}
              </button>
              <button type="button" className={item} role="menuitem" onClick={() => onLang("hinglish")}>
                <span>Hinglish</span>
                {lang === "hinglish" && <CheckIcon size={14} className="text-[var(--cyan)]" />}
              </button>
              <div className="mx-3.5 my-1.5 border-t border-[var(--line)]" />
              <p className="label px-3.5 pb-1 pt-1">{d.menu.theme}</p>
              <button type="button" className={item} role="menuitem" onClick={() => onTheme("dark")}>
                <span>{d.menu.dark}</span>
                {theme === "dark" && <CheckIcon size={14} className="text-[var(--cyan)]" />}
              </button>
              <button type="button" className={item} role="menuitem" onClick={() => onTheme("bright")}>
                <span>{d.menu.bright}</span>
                {theme === "bright" && <CheckIcon size={14} className="text-[var(--cyan)]" />}
              </button>
              <div className="mx-3.5 my-1.5 border-t border-[var(--line)]" />
              <button
                type="button"
                className={item}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onInfo("privacy");
                }}
              >
                <span>{d.menu.privacy}</span>
                <span className="text-[var(--faint)]">›</span>
              </button>
              <button
                type="button"
                className={item}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onInfo("terms");
                }}
              >
                <span>{d.menu.terms}</span>
                <span className="text-[var(--faint)]">›</span>
              </button>
              <button
                type="button"
                className={item}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onInfo("about");
                }}
              >
                <span>{d.menu.about}</span>
                <span className="text-[var(--faint)]">›</span>
              </button>
              <button
                type="button"
                className={item}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onNavigate("settings");
                }}
              >
                <span>{d.menu.settings}</span>
                <span className="text-[var(--faint)]">›</span>
              </button>
            </div>
          </>
        )}
      </div>
      <div data-tauri-drag-region className="flex-1 self-stretch" />
      {pinFailed && (
        <span className="mr-1 text-[10px] text-[var(--s-error)]" role="alert">
          {d.win.pinFailed}
        </span>
      )}
      <button
        type="button"
        className={`winbtn ${pinned ? "on" : ""}`}
        onClick={onTogglePin}
        aria-pressed={pinned}
        aria-label={pinned ? d.win.pin : d.win.unpin}
        title={pinned ? d.win.pin : d.win.unpin}
      >
        <PinIcon size={15} filled={pinned} />
      </button>
      <button type="button" className="winbtn" onClick={hideWindow} aria-label={d.win.hide} title={d.win.hide}>
        <MinusIcon size={15} />
      </button>
      <button type="button" className="winbtn danger" onClick={(e) => closeWindow(e.isTrusted)} aria-label={d.win.close} title={d.win.close}>
        <CloseIcon size={15} />
      </button>
    </header>
  );
}
