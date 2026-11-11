import { invoke } from "@tauri-apps/api/core";
import type { Language } from "../types";
import { redact } from "../comms/redact";
import type { Finding } from "./types";

export interface AiResult {
  findings: Finding[];
  /** Answers thrown away because they did not match the actual code. */
  dropped: number;
}

const CONFIDENCE = new Set(["low", "medium", "high"]);

/**
 * The AI's answer is untrusted. A finding survives only if its quote really is on the line it
 * names; a fix survives only if it matches exactly one place. This stops invented bugs and
 * invented code from reaching the screen. It cannot prove that a surviving finding is right,
 * which is why these are always shown as "AI suspected".
 */
export function validateAi(raw: unknown, code: string, startLine: number): AiResult {
  const list = (raw as { findings?: unknown } | null)?.findings;
  if (!Array.isArray(list)) return { findings: [], dropped: 0 };
  const lines = code.split("\n");
  const findings: Finding[] = [];
  let dropped = 0;

  list.forEach((item: unknown, i) => {
    const f = item as Record<string, unknown>;
    const text = (k: string) => (typeof f?.[k] === "string" ? (f[k] as string) : "");
    const line = f?.line;
    const evidence = text("evidence").trim();
    const onLine = typeof line === "number" ? lines[line - startLine] : undefined;
    if (!evidence || onLine === undefined || !onLine.includes(evidence) || !text("title") || !text("why")) {
      dropped++;
      return;
    }
    const find = text("find");
    const replace = typeof f.replace === "string" ? f.replace : "";
    const fixOk = find.length > 0 && find !== replace && code.split(find).length === 2;
    findings.push({
      id: `ai:${line}:${i}`,
      source: "ai",
      line: line as number,
      evidence,
      confidence: CONFIDENCE.has(text("confidence")) ? (text("confidence") as Finding["confidence"]) : "low",
      title: text("title"),
      why: text("why"),
      how: text("how"),
      sideEffects: text("sideEffects"),
      find: fixOk ? find : undefined,
      replace: fixOk ? replace : undefined,
    });
  });
  return { findings, dropped };
}

/** Secret-looking text is hidden before anything leaves this computer. */
export function prepareForAi(code: string): { code: string; hidden: number } {
  const r = redact(code);
  return { code: r.text, hidden: r.count };
}

export async function reviewWithClaude(code: string, language: string, startLine: number, output: Language): Promise<AiResult> {
  const prepared = prepareForAi(code);
  const raw = await invoke<unknown>("debug_ai_review", { code: prepared.code, language, startLine, output });
  return validateAi(raw, prepared.code, startLine);
}
