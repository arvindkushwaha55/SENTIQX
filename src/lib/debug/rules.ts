import type { EditorContext, Finding } from "./types";

/**
 * Small, deliberately conservative pattern checks that work with no AI and no network.
 * They read real text only, and skip strings and comments so `"if (a = b)"` is not reported.
 * A match means "this pattern is usually a mistake", not "this is a bug".
 */

type Family = "js" | "python";

const FAMILY: Record<string, Family> = {
  javascript: "js",
  typescript: "js",
  javascriptreact: "js",
  typescriptreact: "js",
  python: "python",
};

export const familyOf = (language: string): Family | null => FAMILY[language] ?? null;

/** Blanks out strings and comments, keeping every character position the same. */
export function maskCode(code: string, family: Family): string[] {
  const out: string[] = [];
  let state: "code" | "block" | "s" | "d" | "t" | "py3s" | "py3d" = "code";
  for (const line of code.split("\n")) {
    let m = "";
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const two = line.slice(i, i + 2);
      const three = line.slice(i, i + 3);
      if (state === "code") {
        if (family === "js" && two === "//") {
          m += " ".repeat(line.length - i);
          break;
        }
        if (family === "python" && c === "#") {
          m += " ".repeat(line.length - i);
          break;
        }
        if (family === "js" && two === "/*") {
          state = "block";
          m += "  ";
          i++;
          continue;
        }
        if (family === "python" && (three === "'''" || three === '"""')) {
          state = three === "'''" ? "py3s" : "py3d";
          m += "   ";
          i += 2;
          continue;
        }
        if (c === "'") state = "s";
        else if (c === '"') state = "d";
        else if (c === "`" && family === "js") state = "t";
        m += c === "'" || c === '"' || (c === "`" && family === "js") ? '"' : c;
        continue;
      }
      if (state === "block") {
        if (two === "*/") {
          state = "code";
          m += "  ";
          i++;
        } else m += " ";
        continue;
      }
      if (state === "py3s" || state === "py3d") {
        if (three === (state === "py3s" ? "'''" : '"""')) {
          state = "code";
          m += "   ";
          i += 2;
        } else m += " ";
        continue;
      }
      // inside a one-line string or template
      if (c === "\\") {
        m += "  ";
        i++;
        continue;
      }
      if ((state === "s" && c === "'") || (state === "d" && c === '"') || (state === "t" && c === "`")) {
        state = "code";
        m += '"';
      } else m += " ";
    }
    // Ordinary quotes never span lines; templates and block comments can.
    if (state === "s" || state === "d") state = "code";
    out.push(m);
  }
  return out;
}

interface Hit {
  start: number;
  end: number;
  replace?: string;
}

interface Rule {
  id: string;
  family: Family;
  confidence: "high" | "medium" | "low";
  /** Evidence is hidden when it would show a secret. */
  hideEvidence?: boolean;
  /** Runs on masked text unless `raw` is set. */
  raw?: boolean;
  find: (text: string, rawLine: string) => Hit[];
}

const all = (text: string, re: RegExp, make: (m: RegExpMatchArray, start: number) => Hit | null): Hit[] => {
  const hits: Hit[] = [];
  for (const m of text.matchAll(re)) {
    const h = make(m, m.index ?? 0);
    if (h) hits.push(h);
  }
  return hits;
};

const span = (m: RegExpMatchArray, start: number, replace?: string): Hit => ({ start, end: start + m[0].length, replace });

const RULES: Rule[] = [
  {
    id: "assign-in-condition",
    family: "js",
    confidence: "medium",
    // `if (a = b)`. A doubled `if ((a = b))` is the common way to say it is on purpose, so it is skipped.
    find: (t) =>
      all(t, /\b(?:if|while)\s*\(\s*[A-Za-z_$][\w$.]*\s*=(?![=>])\s*(?:[^()]|\([^()]*\))+\)/g, (m, s) => {
        const eq = m[0].search(/=(?![=>])/);
        return span(m, s, `${m[0].slice(0, eq)}===${m[0].slice(eq + 1)}`);
      }),
  },
  {
    id: "nan-compare",
    family: "js",
    confidence: "high",
    find: (t) =>
      all(t, /(?<![\w$.])([A-Za-z_$][\w$.]*)\s*(===?|!==?)\s*NaN\b/g, (m, s) =>
        span(m, s, `${m[2].startsWith("!") ? "!" : ""}Number.isNaN(${m[1]})`),
      ),
  },
  {
    id: "self-compare",
    family: "js",
    confidence: "medium",
    find: (t) => all(t, /(?<![\w$.])([A-Za-z_$][\w$.]*)\s*(?:===?|!==?)\s*\1(?![\w$.(])/g, (m, s) => span(m, s)),
  },
  {
    id: "loop-off-by-one",
    family: "js",
    confidence: "high",
    // Only a loop that starts at 0: one starting at 1 can be correct with <=.
    find: (t) =>
      all(t, /\bfor\s*\(\s*(?:let|var)?\s*([A-Za-z_$][\w$]*)\s*=\s*0\s*;\s*\1\s*<=\s*([\w$.]+)\.length\s*;/g, (m, s) =>
        span(m, s, m[0].replace("<=", "<")),
      ),
  },
  {
    id: "index-at-length",
    family: "js",
    confidence: "high",
    // `arr[arr.length] = x` is a valid way to append, so only reads are reported.
    find: (t) =>
      all(t, /(?<![\w$.])([A-Za-z_$][\w$.]*)\[\1\.length\](?!\s*=[^=])/g, (m, s) => span(m, s, `${m[1]}[${m[1]}.length - 1]`)),
  },
  {
    id: "async-foreach",
    family: "js",
    confidence: "medium",
    find: (t) => all(t, /\.forEach\(\s*async\b/g, (m, s) => span(m, s)),
  },
  {
    id: "empty-catch",
    family: "js",
    confidence: "medium",
    find: (t) => all(t, /\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/g, (m, s) => span(m, s)),
  },
  {
    id: "eval",
    family: "js",
    confidence: "high",
    find: (t) => all(t, /(?<![\w$.])eval\s*\(/g, (m, s) => span(m, s)),
  },
  {
    id: "hardcoded-secret",
    family: "js",
    confidence: "medium",
    raw: true,
    hideEvidence: true,
    find: (_, raw) =>
      all(raw, /\b(?:password|passwd|secret|api_?key|auth_?token)\s*[:=]\s*(['"`])[^'"`\s]{6,}\1/gi, (m, s) => span(m, s)),
  },
  {
    id: "py-mutable-default",
    family: "python",
    confidence: "high",
    find: (t) => all(t, /^\s*(?:async\s+)?def\s+\w+\([^)]*=\s*(?:\[\s*\]|\{\s*\}|set\(\s*\))/g, (m, s) => span(m, s)),
  },
  {
    id: "py-bare-except",
    family: "python",
    confidence: "medium",
    find: (t) => all(t, /^\s*except\s*:/g, (m, s) => span(m, s, m[0].replace(/except\s*:/, "except Exception:"))),
  },
  {
    id: "py-none-compare",
    family: "python",
    confidence: "medium",
    find: (t) =>
      all(t, /([\w.\])]+)\s*(==|!=)\s*None\b/g, (m, s) => span(m, s, `${m[1]} ${m[2] === "==" ? "is" : "is not"} None`)),
  },
  {
    id: "py-eval",
    family: "python",
    confidence: "high",
    find: (t) => all(t, /(?<![\w.])(?:eval|exec)\s*\(/g, (m, s) => span(m, s)),
  },
];

export function runRules(code: string, language: string, startLine: number): Finding[] {
  const family = familyOf(language);
  if (!family) return [];
  const rawLines = code.split("\n");
  const masked = maskCode(code, family);
  const findings: Finding[] = [];
  for (const rule of RULES) {
    if (rule.family !== family) continue;
    rawLines.forEach((rawLine, i) => {
      for (const hit of rule.find(rule.raw ? rawLine : masked[i], rawLine)) {
        const quote = rawLine.slice(hit.start, hit.end);
        // A fix is offered only when the original text sits exactly once in the selection.
        const safe = hit.replace !== undefined && code.split(quote).length === 2;
        findings.push({
          id: `rule:${rule.id}:${startLine + i}:${hit.start}`,
          source: "rule",
          ruleId: rule.id,
          line: startLine + i,
          evidence: rule.hideEvidence ? "[hidden]" : quote.trim(),
          confidence: rule.confidence,
          find: safe ? quote : undefined,
          replace: safe ? hit.replace : undefined,
        });
      }
    });
  }
  return findings.sort((a, b) => a.line - b.line);
}

export function diagnosticsToFindings(ctx: EditorContext): Finding[] {
  return ctx.diagnostics
    .filter((d) => d.severity === "error" || d.severity === "warning")
    .map((d, i) => ({
      id: `diag:${d.line}:${i}`,
      source: "diagnostic" as const,
      line: d.line,
      evidence: ctx.code.split("\n")[d.line - ctx.startLine]?.trim() ?? "",
      confidence: "reported" as const,
      title: d.message,
    }));
}
