import { useMemo, useState } from "react";
import { analyse } from "../lib/comms/analyse";
import { parseChat, participantsOf } from "../lib/comms/parse";
import { HIDDEN, redact } from "../lib/comms/redact";
import { type Analysis, type Item, MAX_CHARS } from "../lib/comms/types";
import type { Dict, SummaryFacts } from "../lib/i18n";
import { ChatIcon, CheckIcon, ShieldIcon, SparkIcon, TrashIcon } from "./icons";
import { Button, Card, Chip, Empty, Label } from "./ui";

const KEY = "sentiqx.intel.saved";
const MAX_SAVED = 20;

interface Saved {
  id: string;
  at: number;
  facts: SummaryFacts;
  words: string[];
  sections: Pick<Analysis, "pending" | "questions" | "actions" | "dates" | "important">;
}

function loadSaved(): Saved[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? (v as Saved[]) : [];
  } catch {
    return [];
  }
}

function persist(list: Saved[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* not persisted: the in-memory list still works */
  }
}

const factsOf = (a: Analysis): SummaryFacts => ({
  messages: a.messageCount,
  people: a.participants,
  from: a.firstStamp,
  to: a.lastStamp,
  questions: a.questions.length,
  actions: a.actions.length,
  dates: a.dates.length,
  pending: a.pending === null ? null : a.pending.length,
});

type Stage = "input" | "review" | "result";

export function IntelView({ d }: { d: Dict }) {
  const t = d.intel;
  const [stage, setStage] = useState<Stage>("input");
  const [text, setText] = useState("");
  const [me, setMe] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [saved, setSaved] = useState<Saved[]>(loadSaved);
  const [justSaved, setJustSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const clipped = text.length > MAX_CHARS ? text.slice(-MAX_CHARS) : text;
  const prepared = useMemo(() => {
    const r = redact(clipped);
    const msgs = parseChat(r.text);
    return { redacted: r.text, hidden: r.count, msgs, people: participantsOf(msgs) };
  }, [clipped]);

  const reset = () => {
    setText("");
    setMe("");
    setAnalysis(null);
    setJustSaved(false);
    setCopied(false);
    setStage("input");
  };

  const run = () => {
    setAnalysis(analyse(prepared.msgs, me || null));
    setJustSaved(false);
    setCopied(false);
    setStage("result");
  };

  const save = () => {
    if (!analysis) return;
    const entry: Saved = {
      id: `${Date.now()}`,
      at: Date.now(),
      facts: factsOf(analysis),
      words: analysis.frequentWords,
      sections: {
        pending: analysis.pending,
        questions: analysis.questions,
        actions: analysis.actions,
        dates: analysis.dates,
        important: analysis.important,
      },
    };
    const next = [entry, ...saved].slice(0, MAX_SAVED);
    setSaved(next);
    persist(next);
    setJustSaved(true);
  };

  const remove = (id: string | null) => {
    const next = id === null ? [] : saved.filter((s) => s.id !== id);
    setSaved(next);
    persist(next);
  };

  const copy = async () => {
    if (!analysis) return;
    const lines = [t.summary(factsOf(analysis)), ""];
    const add = (title: string, items: Item[] | null) => {
      if (!items || items.length === 0) return;
      lines.push(`${title}:`, ...items.map((i) => `- ${i.sender ? `${i.sender}: ` : ""}${i.text.replace(/\n/g, " ")}`), "");
    };
    add(t.pending, analysis.pending);
    add(t.questions, analysis.questions);
    add(t.actions, analysis.actions);
    add(t.dates, analysis.dates);
    add(t.important, analysis.important);
    try {
      await navigator.clipboard.writeText(lines.join("\n").trim());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="px-1">
        <h2 className="display text-[18px] font-semibold tracking-tight">{t.title}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{t.subtitle}</p>
      </div>

      {stage === "input" && (
        <>
          <Card>
            <label htmlFor="intel-text">
              <Label>{t.pasteLabel}</Label>
            </label>
            <textarea
              id="intel-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t.placeholder}
              spellCheck={false}
              rows={9}
              className="field mt-2 w-full resize-y p-3 font-mono text-[12px] leading-relaxed"
            />
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-[var(--muted)]">
              <span className="font-mono">{t.chars(text.length, MAX_CHARS)}</span>
              {text.length > MAX_CHARS && <span className="text-[var(--s-waiting)]">{t.tooLong(MAX_CHARS)}</span>}
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="primary" className="flex-1" disabled={!text.trim()} onClick={() => setStage("review")}>
                {t.review}
              </Button>
              <Button variant="subtle" disabled={!text} onClick={reset}>
                {t.clear}
              </Button>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 text-[var(--cyan)]">
              <ShieldIcon size={15} />
              <Label className="!text-[var(--cyan)]">{t.privacyTitle}</Label>
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
        </>
      )}

      {stage === "review" && (
        <Card>
          <Label>{t.reviewTitle}</Label>
          <p className="mt-1 text-xs text-[var(--muted)]">{t.reviewNote}</p>
          <pre className="codeblock selectable mt-2.5 max-h-52 overflow-auto whitespace-pre-wrap break-words p-3 text-[11.5px]">
            {prepared.redacted.split(HIDDEN).flatMap((part, i, arr) =>
              i < arr.length - 1
                ? [part, <mark key={i} className="rounded bg-[rgba(255,200,87,0.2)] px-1 text-[var(--s-waiting)]">{HIDDEN}</mark>]
                : [part],
            )}
          </pre>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Chip color={prepared.hidden > 0 ? "var(--s-waiting)" : "var(--s-done)"}>{t.hidden(prepared.hidden)}</Chip>
            <Chip>{prepared.people.length > 0 ? t.detected(prepared.msgs.length, prepared.people.length) : t.detectedPlain}</Chip>
          </div>
          {prepared.people.length > 0 && (
            <div className="mt-3">
              <label htmlFor="intel-me">
                <Label>{t.whoAreYou}</Label>
              </label>
              <select
                id="intel-me"
                value={me}
                onChange={(e) => setMe(e.target.value)}
                className="field mt-1.5 w-full px-3 py-2 text-[13px]"
              >
                <option value="">{t.notSelected}</option>
                {prepared.people.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-[var(--muted)]">{t.whoHint}</p>
            </div>
          )}
          <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">{t.privacyLines[1]}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" onClick={() => setStage("input")}>
              {t.editText}
            </Button>
            <Button variant="primary" className="flex-1" disabled={prepared.msgs.length === 0} onClick={run}>
              <SparkIcon size={14} />
              {t.analyse}
            </Button>
          </div>
        </Card>
      )}

      {stage === "result" && analysis && (
        <>
          <Card accent="var(--cyan)">
            <Label>{t.summaryTitle}</Label>
            <p className="selectable mt-1.5 text-[14px] leading-relaxed">{t.summary(factsOf(analysis))}</p>
            {analysis.frequentWords.length > 0 && (
              <div className="mt-3">
                <Label>{t.frequentWords}</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {analysis.frequentWords.map((w) => (
                    <Chip key={w}>{w}</Chip>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--muted)]">{t.localNote}</p>
          </Card>

          {analysis.pending === null ? (
            <Card>
              <Label>{t.pending}</Label>
              <p className="mt-1.5 text-xs text-[var(--muted)]">{t.pendingNeedMe}</p>
            </Card>
          ) : (
            <Section title={t.pending} items={analysis.pending} none={t.none} color="var(--s-waiting)" />
          )}
          <Section title={t.questions} items={analysis.questions} none={t.none} color="var(--cyan)" />
          <Section title={t.actions} items={analysis.actions} none={t.none} color="var(--violet)" />
          <Section title={t.dates} items={analysis.dates} none={t.none} color="var(--blue)" showMatches />
          <Section title={t.important} items={analysis.important} none={t.none} color="var(--s-stuck)" />

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={justSaved} onClick={save}>
              {justSaved ? t.saved : t.save}
            </Button>
            <Button variant="ghost" onClick={() => void copy()}>
              {copied ? t.copied : t.copy}
            </Button>
            <Button variant="subtle" onClick={reset}>
              {t.newAnalysis}
            </Button>
          </div>
        </>
      )}

      {stage === "input" && !text && saved.length === 0 && (
        <Empty icon={<ChatIcon size={22} />} title={t.empty} />
      )}

      {saved.length > 0 && (
        <Card>
          <div className="flex items-center justify-between">
            <Label>{t.savedTitle}</Label>
            <button type="button" className="text-[11px] text-[var(--muted)] hover:text-[var(--s-error)]" onClick={() => remove(null)}>
              {t.deleteAll}
            </button>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">{t.savedNote}</p>
          <ul className="mt-2.5 space-y-2">
            {saved.map((s) => (
              <li key={s.id} className="rounded-xl border border-[var(--line)] bg-[rgba(8,12,20,0.5)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-mono text-[10.5px] text-[var(--faint)]">{new Date(s.at).toLocaleString()}</p>
                  <button type="button" className="winbtn !h-6 !w-6 danger" onClick={() => remove(s.id)} title={t.deleteOne} aria-label={t.deleteOne}>
                    <TrashIcon size={13} />
                  </button>
                </div>
                <p className="mt-1 text-[12.5px] leading-snug">{t.summary(s.facts)}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Section({
  title,
  items,
  none,
  color,
  showMatches,
}: {
  title: string;
  items: Item[];
  none: string;
  color: string;
  showMatches?: boolean;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <Label>{title}</Label>
        <span className="chip" style={{ color }}>
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="mt-1.5 text-xs text-[var(--muted)]">{none}</p>
      ) : (
        <ul className="mt-2.5 space-y-2.5">
          {items.map((it, i) => (
            <li key={i} className="border-l-2 pl-2.5" style={{ borderColor: color }}>
              {it.sender && <p className="font-mono text-[10.5px] text-[var(--faint)]">{it.sender}</p>}
              <p className="selectable whitespace-pre-wrap break-words text-[12.5px] leading-snug">{it.text}</p>
              {showMatches && it.matches && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {it.matches.map((m) => (
                    <span key={m} className="chip" style={{ color }}>
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
