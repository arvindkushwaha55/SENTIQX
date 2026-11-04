import type { Dict } from "../lib/i18n";
import { closeWindow, hideWindow } from "../lib/windowControls";
import { CloseIcon, LogoMark, MinusIcon, PinIcon } from "./icons";

/**
 * Custom title bar for the frameless window. The empty area is a native drag region
 * (Tauri `data-tauri-drag-region`), so moving the window is handled by Windows itself.
 */
export function TitleBar({
  d,
  pinned,
  onTogglePin,
  pinFailed,
}: {
  d: Dict;
  pinned: boolean;
  onTogglePin: () => void;
  pinFailed: boolean;
}) {
  return (
    <header
      data-tauri-drag-region
      className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line)] pl-3.5 pr-2"
    >
      <div data-tauri-drag-region className="pointer-events-none flex min-w-0 items-center gap-2.5">
        <LogoMark size={20} />
        <span className="font-mono text-[12px] font-semibold tracking-[0.28em]">SENTIQX</span>
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
      <button type="button" className="winbtn danger" onClick={closeWindow} aria-label={d.win.close} title={d.win.close}>
        <CloseIcon size={15} />
      </button>
    </header>
  );
}
