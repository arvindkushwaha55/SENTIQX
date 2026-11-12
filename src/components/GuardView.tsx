import { useState } from "react";
import type { ActiveApp, Category } from "../lib/appContext";
import type { Dict } from "../lib/i18n";
import { checkText, suppressKey, type Threshold } from "../lib/intentGuard";
import { AlertIcon, CheckIcon, ShieldIcon } from "./icons";
import { Button, Card, Chip, Label } from "./ui";

const SUPPRESS_KEY = "sentiqx.guard.suppressed";
const THRESHOLD_KEY = "sentiqx.guard.threshold";
const BEEP_KEY = "sentiqx.guard.beep";
const MAX_CHARS = 20_000;
const CATEGORIES: Category[] = ["coding", "communication", "browser", "terminal", "other"];

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* settings simply won't persist */
  }
}
function loadSuppressed(): string[] {
  try {
    const v: unknown = JSON.parse(read(SUPPRESS_KEY) ?? "[]");
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}

/** A short two-tone beep through WebAudio. No asset, no native plugin. */
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(ctx.destination);
      const at = ctx.currentTime + i * 0.14;
      osc.start(at);
      osc.stop(at + 0.12);
    });
    window.setTimeout(() => void ctx.close().catch(() => undefined), 600);
  } catch {
    /* sound is optional: the warning card is the real signal */
  }
}

interface Result {
  warn: boolean;
  intentLabel: string;
  destLabel: string;
  reasons: string[];
  secretsHidden: number;
  suppress: string;
}

export function GuardView({ d, app }: { d: Dict; app: ActiveApp | null }) {
  const t = d.guard;
  const [text, setText] = useState("");
  const [manualDest, setManualDest] = useState<Category>("communication");
  const [threshold, setThreshold] = useState<Threshold>(() =>
    read(THRESHOLD_KEY) === "off" || read(THRESHOLD_KEY) === "all" ? (read(THRESHOLD_KEY) as Threshold) : "high",
  );
  const [beepOn, setBeepOn] = useState(() => read(BEEP_KEY) !== "0");
  const [suppressed, setSuppressed] = useState<string[]>(loadSuppressed);
  const [result, setResult] = useState<Result | null>(null);
  const [clipFailed, setClipFailed] = useState(false);
  const [fineSaved, setFineSaved] = useState(false);

  const dest: Category = app ? app.category : manualDest;
  const destLabel = app ? t.destAuto(app.name) : t.destUnknown;

  const run = () => {
    const clipped = text.slice(0, MAX_CHARS);
    const r = checkText(clipped, dest, threshold, suppressed);
    setFineSaved(false);
    setResult({
      warn: r.warn,
      intentLabel: t.intentLabels[r.intent.kind] ?? r.intent.kind,
      destLabel: app ? app.name : d.home.categories[dest],
      reasons: r.mismatch.reasons.map((code) => t.reasons[code] ?? code),
      secretsHidden: r.intent.secretsHidden,
      suppress: suppressKey(r.intent.kind, dest),
    });
    if (r.warn && beepOn) beep();
  };

  const fromClipboard = async () => {
    try {
      const v = await navigator.clipboard.readText();
      setText(v.slice(0, MAX_CHARS));
      setClipFailed(false);
      setResult(null);
    } catch {
      setClipFailed(true);
    }
  };

  const markFine = () => {
    if (!result) return;
    const next = [...new Set([...suppressed, result.suppress])];
    setSuppressed(next);
    write(SUPPRESS_KEY, JSON.stringify(next));
    setResult(null);
    setFineSaved(true);
  };

  const clear = () => {
    setText("");
    setResult(null);
    setFineSaved(false);
    setClipFailed(false);
  };

  return (
    <div className="space-y-3">
      <div className="px-1">
        <h2 className="display text-[18px] font-semibold tracking-tight">{t.title}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{t.subtitle}</p>
      </div>

      <Card>
        <label htmlFor="guard-text">
          <Label>{t.pasteLabel}</Label>
        </label>
        <textarea
          id="guard-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          placeholder={t.placeholder}
          spellCheck={false}
          rows={7}
          className="field mt-2 w-full resize-y p-3 font-mono text-[12px] leading-relaxed"
        />
        {clipFailed && <p className="mt-1.5 text-[11px] text-[var(--s-waiting)]">{t.clipboardFailed}</p>}
        <div className="mt-3 flex gap-2">
          <Button variant="primary" className="flex-1" disabled={!text.trim()} onClick={run}>
            {t.check}
          </Button>
          <Button variant="subtle" onClick={() => void fromClipboard()}>
            {t.fromClipboard}
          </Button>
          <Button variant="subtle" disabled={!text} onClick={clear}>
            {t.clear}
          </Button>
        </div>
      </Card>

      <Card>
        <Label>{t.destLabel}</Label>
        <p className="mt-1.5 text-[13px]">{destLabel}</p>
        {!app && (
          <label className="mt-2 block">
            <span className="sr-only">{t.destManual}</span>
            <select
              value={manualDest}
              onChange={(e) => setManualDest(e.target.value as Category)}
              className="field w-full px-3 py-2 text-[13px]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {d.home.categories[c]}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Label>{t.thresholdLabel}</Label>
          {(Object.keys(t.thresholds) as Threshold[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setThreshold(k);
                write(THRESHOLD_KEY, k);
              }}
            >
              <Chip color={threshold === k ? "var(--cyan)" : undefined}>{t.thresholds[k]}</Chip>
            </button>
          ))}
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={beepOn}
            onChange={(e) => {
              setBeepOn(e.target.checked);
              write(BEEP_KEY, e.target.checked ? "1" : "0");
            }}
          />
          {t.beepLabel}
        </label>
      </Card>

      {result?.warn && (
        <Card accent="var(--s-waiting)">
          <div className="flex items-center gap-2 text-[var(--s-waiting)]">
            <AlertIcon size={16} />
            <p className="text-[14px] font-semibold text-[var(--text)]">{t.warnTitle}</p>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed">{t.warnBody(result.intentLabel, result.destLabel)}</p>
          {result.reasons.length > 0 && (
            <ul className="mt-2 space-y-1">
              {result.reasons.map((r) => (
                <li key={r} className="text-xs text-[var(--muted)]">
                  • {r}
                </li>
              ))}
            </ul>
          )}
          {result.secretsHidden > 0 && (
            <p className="mt-2 text-[11px] text-[var(--muted)]">{t.secretsNote(result.secretsHidden)}</p>
          )}
          <div className="mt-3 flex gap-2">
            <Button variant="subtle" onClick={markFine}>
              {t.thisIsFine}
            </Button>
            <Button variant="ghost" onClick={() => setResult(null)}>
              {t.dismiss}
            </Button>
          </div>
        </Card>
      )}

      {result && !result.warn && (
        <Card accent="var(--s-done)">
          <div className="flex items-center gap-2 text-[var(--s-done)]">
            <CheckIcon size={15} />
            <p className="text-[14px] font-semibold text-[var(--text)]">{t.okTitle}</p>
          </div>
          <p className="mt-1.5 text-[13px] text-[var(--muted)]">{t.okBody(result.intentLabel)}</p>
          {result.secretsHidden > 0 && (
            <p className="mt-2 text-[11px] text-[var(--muted)]">{t.secretsNote(result.secretsHidden)}</p>
          )}
        </Card>
      )}

      {fineSaved && <p className="px-1 text-xs text-[var(--s-done)]">{t.fineSaved}</p>}

      <Card>
        <div className="flex items-center gap-2 text-[var(--cyan)]">
          <ShieldIcon size={15} />
          <Label className="!text-[var(--cyan)]">Privacy</Label>
        </div>
        <ul className="mt-2.5 space-y-2">
          {t.privacyLines.map((line) => (
            <li key={line} className="flex gap-2 text-[12.5px] leading-snug text-[var(--text)]/90">
              <CheckIcon size={13} className="mt-0.5 shrink-0 text-[var(--s-done)]" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
