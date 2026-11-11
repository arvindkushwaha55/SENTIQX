import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useState } from "react";
import { prepareForAi, reviewWithClaude } from "../lib/debug/ai";
import { applyFix, fingerprint, lineDiff } from "../lib/debug/diff";
import { diagnosticsToFindings, familyOf, runRules } from "../lib/debug/rules";
import type { EditorContext, Finding } from "../lib/debug/types";
import type { Dict } from "../lib/i18n";
import type { Language } from "../lib/types";
import { BugIcon, ShieldIcon, SparkIcon } from "./icons";
import { Button, Card, Chip, Empty, Label } from "./ui";

const IGNORE_KEY = "sentiqx.debug.ignored";
const MAX_IGNORED = 500;

function loadIgnored(): Set<string> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(IGNORE_KEY) ?? "[]");
    return new Set(Array.isArray(v) ? (v as string[]) : []);
  } catch {
    return new Set();
  }
}

const SOURCE_COLOR = { diagnostic: "var(--s-error)", rule: "var(--s-waiting)", ai: "var(--violet)" } as const;

type ApplyState = { id: string; status: string } | null;

export function DebugView({
  d,
  lang,
  onContext,
}: {
  d: Dict;
  lang: Language;
  onContext: (trigger: EditorContext["trigger"]) => void;
}) {
  const t = d.debug;
  const [ctx, setCtx] = useState<EditorContext | null>(null);
  const [ai, setAi] = useState<{ findings: Finding[]; dropped: number; lang: Language } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [ignored, setIgnored] = useState<Set<string>>(loadIgnored);
  const [showIgnored, setShowIgnored] = useState(false);
  const [apply, setApply] = useState<ApplyState>(null);

  useEffect(() => {
    invoke<EditorContext | null>("editor_latest").then((c) => c && setCtx(c)).catch(() => undefined);
    const stops: Promise<() => void>[] = [
      listen<EditorContext>("editor-context", (m) => {
        setCtx(m.payload);
        setAi(null);
        setAiError(null);
        setApply(null);
        onContext(m.payload.trigger);
      }),
      listen<{ id: string; status: string }>("editor-apply-result", (m) => setApply(m.payload)),
    ];
    return () => {
      for (const s of stops) void s.then((un) => un()).catch(() => undefined);
    };
  }, [onContext]);

  const local = useMemo(
    () => (ctx ? [...diagnosticsToFindings(ctx), ...runRules(ctx.code, ctx.language, ctx.startLine)] : []),
    [ctx],
  );
  const hiddenForAi = useMemo(() => (ctx ? prepareForAi(ctx.code).hidden : 0), [ctx]);
  const aiShown = ai && ai.lang === lang ? ai.findings : [];
  const fp = (f: Finding) => fingerprint(ctx?.file ?? "", f.ruleId ?? f.title ?? "", f.evidence);
  const all = [...local, ...aiShown];
  const visible = all.filter((f) => showIgnored || !ignored.has(fp(f)));
  const ignoredCount = all.length - all.filter((f) => !ignored.has(fp(f))).length;

  const ignore = (f: Finding) => {
    const next = new Set(ignored).add(fp(f));
    setIgnored(next);
    try {
      localStorage.setItem(IGNORE_KEY, JSON.stringify([...next].slice(-MAX_IGNORED)));
    } catch {
      /* not remembered after a restart */
    }
  };

  const runAi = async () => {
    if (!ctx) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const r = await reviewWithClaude(ctx.code, ctx.language, ctx.startLine, lang);
      setAi({ ...r, lang });
    } catch (e) {
      setAiError(String(e));
    } finally {
      setAiBusy(false);
    }
  };

  const forget = () => {
    void invoke("editor_clear").catch(() => undefined);
    setCtx(null);
    setAi(null);
    setApply(null);
  };

  return (
    <div className="space-y-3">
      <div className="px-1">
        <h2 className="text-[17px] font-semibold tracking-tight">{t.title}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{t.subtitle}</p>
      </div>

      {!ctx ? (
        <Card>
          <Empty icon={<BugIcon size={22} />} title={t.setupTitle} />
          <ol className="-mt-3 list-decimal space-y-1.5 pl-5 text-[13px] leading-snug">
            {t.setupSteps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <div className="mt-3 flex gap-2 border-t border-[var(--line)] pt-3 text-xs leading-relaxed text-[var(--muted)]">
            <ShieldIcon size={14} className="mt-0.5 shrink-0 text-[var(--cyan)]" />
            <span>{t.setupPrivacy}</span>
          </div>
        </Card>
      ) : (
        <>
          <section className="hero rise p-4" data-status={local.some((f) => f.source === "diagnostic") ? "error" : "working"}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-[13px] font-medium" title={ctx.file}>
                  {ctx.file}
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {t.lines(ctx.startLine, ctx.endLine)} · {ctx.language}
                </p>
              </div>
              <Chip>{t.trigger[ctx.trigger]}</Chip>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              {!familyOf(ctx.language) ? <p className="min-w-0 text-[11px] leading-snug text-[var(--muted)]">{t.noRulesFor(ctx.language)}</p> : <span />}
              <button type="button" className="shrink-0 text-[11px] text-[var(--muted)] hover:text-[var(--text)]" onClick={forget}>
                {t.forget}
              </button>
            </div>
          </section>

          {apply && (
            <Card accent={apply.status === "applied" ? "var(--s-done)" : "var(--s-waiting)"}>
              <p className="text-[13px] leading-snug" role="status">
                {apply.status === "waiting" ? t.applyWaiting : t.applyResult[apply.status as keyof typeof t.applyResult] ?? apply.status}
              </p>
            </Card>
          )}

          {local.length === 0 && <p className="px-1 text-[13px] leading-snug text-[var(--muted)]">{t.noFindings}</p>}

          {visible.map((f) => (
            <FindingCard key={f.id} d={d} ctx={ctx} f={f} onIgnore={() => ignore(f)} setApply={setApply} />
          ))}

          {ignoredCount > 0 && (
            <div className="flex items-center gap-2 px-1 text-xs text-[var(--muted)]">
              {t.ignoredCount(ignoredCount)}
              {!showIgnored && (
                <button type="button" className="underline hover:text-[var(--text)]" onClick={() => setShowIgnored(true)}>
                  {t.showIgnored}
                </button>
              )}
            </div>
          )}

          <Card>
            <div className="flex items-center gap-2 text-[var(--violet)]">
              <SparkIcon size={15} />
              <Label className="!text-[var(--violet)]">{t.ai.title}</Label>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{t.ai.consent}</p>
            {hiddenForAi > 0 && <p className="mt-1.5 text-xs text-[var(--s-waiting)]">{t.ai.hiddenNote(hiddenForAi)}</p>}
            {ai && ai.lang !== lang && <p className="mt-1.5 text-xs text-[var(--s-waiting)]">{t.ai.languageChanged}</p>}
            {ai && ai.lang === lang && ai.findings.length === 0 && <p className="mt-2 text-[13px] leading-snug">{t.ai.none}</p>}
            {ai && ai.lang === lang && ai.dropped > 0 && <p className="mt-1.5 text-xs text-[var(--muted)]">{t.ai.dropped(ai.dropped)}</p>}
            {aiError && (
              <p className="mt-2 break-words text-xs text-[var(--s-error)]" role="alert">
                {t.ai.failed(aiError)}
              </p>
            )}
            <Button variant="ghost" className="mt-3 w-full" disabled={aiBusy} onClick={() => void runAi()}>
              <span className={aiBusy ? "shimmer" : ""}>{aiBusy ? t.ai.running : t.ai.run}</span>
            </Button>
          </Card>
        </>
      )}
    </div>
  );
}

function FindingCard({
  d,
  ctx,
  f,
  onIgnore,
  setApply,
}: {
  d: Dict;
  ctx: EditorContext;
  f: Finding;
  onIgnore: () => void;
  setApply: (a: ApplyState) => void;
}) {
  const t = d.debug;
  const rule = f.ruleId ? t.rules[f.ruleId] : undefined;
  const title = rule?.title ?? f.title ?? "";
  const why = f.source === "diagnostic" ? t.diagnosticWhy : (rule?.why ?? f.why ?? "");
  const how = f.source === "diagnostic" ? t.diagnosticHow : (rule?.how ?? f.how ?? "");
  const side = rule?.sideEffects ?? f.sideEffects ?? t.noSideEffects;
  const [open, setOpen] = useState<"explain" | "fix" | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const color = SOURCE_COLOR[f.source];
  const hasFix = f.find !== undefined && f.replace !== undefined;
  const after = hasFix ? applyFix(ctx.code, f.find as string, f.replace as string) : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(f.replace ?? "");
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const send = async () => {
    setConfirming(false);
    setFailed(null);
    const id = `${Date.now()}`;
    try {
      await invoke("editor_apply", { request: { id, uri: ctx.uri, version: ctx.version, find: f.find, replace: f.replace } });
      setApply({ id, status: "waiting" });
    } catch (e) {
      setFailed(t.applyFailed(String(e)));
    }
  };

  return (
    <Card accent={color}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip color={color}>{t.source[f.source]}</Chip>
        <Chip>
          {t.confidenceLabel}: {t.confidence[f.confidence]}
        </Chip>
      </div>
      <p className="mt-2 font-mono text-[11px] text-[var(--faint)]">
        {ctx.file} · {t.line(f.line)}
      </p>
      <p className="selectable mt-1 text-[14px] font-medium leading-snug">{title}</p>
      {f.evidence && (
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--bg0)] p-2 font-mono text-[11.5px] leading-relaxed">{f.evidence}</pre>
      )}

      {open === "explain" && (
        <dl className="mt-3 space-y-2.5">
          <div>
            <dt className="label">{t.why}</dt>
            <dd className="mt-0.5 text-[13px] leading-snug">{why}</dd>
          </div>
          <div>
            <dt className="label">{t.how}</dt>
            <dd className="mt-0.5 text-[13px] leading-snug">{how}</dd>
          </div>
        </dl>
      )}

      {open === "fix" && (
        <div className="mt-3">
          {after === null ? (
            <p className="text-xs text-[var(--muted)]">{t.noFixAvailable}</p>
          ) : (
            <>
              <Label>{t.fixTitle}</Label>
              <div className="selectable mt-1.5 overflow-x-auto rounded-lg bg-[var(--bg0)] p-2 font-mono text-[11.5px] leading-relaxed">
                {lineDiff(ctx.code, after).map((l, i) => (
                  <div
                    key={i}
                    className="whitespace-pre-wrap break-words"
                    style={{ color: l.kind === "del" ? "var(--s-error)" : l.kind === "add" ? "var(--s-done)" : "var(--faint)" }}
                  >
                    {l.kind === "del" ? "- " : l.kind === "add" ? "+ " : "  "}
                    {l.text}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[13px] leading-snug">{how}</p>
              <p className="mt-2 text-xs leading-snug text-[var(--muted)]">
                {t.sideEffects}: {side}
              </p>
              <p className="mt-1.5 text-xs leading-snug text-[var(--s-waiting)]">{t.fixUnverified}</p>
            </>
          )}
        </div>
      )}

      {confirming && (
        <div className="mt-3 rounded-xl border border-[var(--line-strong)] p-3">
          <p className="text-xs leading-relaxed">{t.applyConfirm}</p>
          <div className="mt-2 flex gap-2">
            <Button variant="subtle" onClick={() => setConfirming(false)}>
              {t.applyCancel}
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => void send()}>
              {t.applyGo}
            </Button>
          </div>
        </div>
      )}
      {failed && (
        <p className="mt-2 break-words text-xs text-[var(--s-error)]" role="alert">
          {failed}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button variant="subtle" className="!min-h-8 !px-2.5 !py-1 !text-[12px]" onClick={() => setOpen(open === "explain" ? null : "explain")}>
          {open === "explain" ? t.actions.hideExplain : t.actions.explain}
        </Button>
        {after !== null && (
          <>
            <Button variant="subtle" className="!min-h-8 !px-2.5 !py-1 !text-[12px]" onClick={() => setOpen(open === "fix" ? null : "fix")}>
              {open === "fix" ? t.actions.hideFix : t.actions.showFix}
            </Button>
            <Button variant="subtle" className="!min-h-8 !px-2.5 !py-1 !text-[12px]" onClick={() => void copy()}>
              {copied ? t.actions.copied : t.actions.copyFix}
            </Button>
            {open === "fix" && (
              <Button variant="ghost" className="!min-h-8 !px-2.5 !py-1 !text-[12px]" onClick={() => setConfirming(true)}>
                {t.actions.apply}
              </Button>
            )}
          </>
        )}
        <Button variant="subtle" className="!min-h-8 !px-2.5 !py-1 !text-[12px]" onClick={onIgnore}>
          {t.actions.ignore}
        </Button>
      </div>
    </Card>
  );
}
