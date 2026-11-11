export interface DiffLine {
  kind: "same" | "del" | "add";
  text: string;
}

/** Applies a fix to text. Returns null unless `find` occurs exactly once. */
export function applyFix(code: string, find: string, replace: string): string | null {
  if (!find) return null;
  const parts = code.split(find);
  return parts.length === 2 ? parts.join(replace) : null;
}

/** Line diff trimmed to the changed part, with one line of context on each side. */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA--;
    endB--;
  }
  const out: DiffLine[] = [];
  if (start > 0) out.push({ kind: "same", text: a[start - 1] });
  for (let i = start; i <= endA; i++) out.push({ kind: "del", text: a[i] });
  for (let i = start; i <= endB; i++) out.push({ kind: "add", text: b[i] });
  if (endA + 1 < a.length) out.push({ kind: "same", text: a[endA + 1] });
  return out;
}

/** A short fingerprint, so "ignored" can be remembered without storing any code. */
export function fingerprint(file: string, ruleOrTitle: string, evidence: string): string {
  let h = 5381;
  for (const ch of `${file}|${ruleOrTitle}|${evidence}`) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
}
