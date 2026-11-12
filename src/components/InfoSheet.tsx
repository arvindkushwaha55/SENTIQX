import type { Dict } from "../lib/i18n";
import type { InfoKind } from "./TitleBar";
import { CloseIcon } from "./icons";
import { Button } from "./ui";

/** Read-only sheet for the Privacy Policy, Terms of Use and About texts (TitleBar menu). */
export function InfoSheet({ d, kind, onClose }: { d: Dict; kind: InfoKind; onClose: () => void }) {
  const title = kind === "privacy" ? d.info.privacyTitle : kind === "terms" ? d.info.termsTitle : d.info.aboutTitle;
  const body = kind === "privacy" ? d.info.privacyBody : kind === "terms" ? d.info.termsBody : d.info.aboutBody;

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-[var(--overlay)] p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="surface rise max-h-full w-full max-w-[460px] overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="display text-[15px] font-semibold tracking-tight">{title}</h2>
          <button type="button" className="winbtn" onClick={onClose} aria-label={d.info.close} title={d.info.close}>
            <CloseIcon size={15} />
          </button>
        </div>
        <div className="mt-2.5 space-y-2.5">
          {body.map((p) => (
            <p key={p.slice(0, 24)} className="text-[13px] leading-relaxed text-[var(--muted)]">
              {p}
            </p>
          ))}
        </div>
        <Button variant="subtle" className="mt-4 w-full" onClick={onClose}>
          {d.info.close}
        </Button>
      </div>
    </div>
  );
}
