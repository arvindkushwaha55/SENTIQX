export interface EditorDiagnostic {
  line: number;
  message: string;
  severity: string;
  source?: string | null;
  code?: string | null;
}

export interface EditorContext {
  file: string;
  uri: string;
  language: string;
  version: number;
  startLine: number;
  endLine: number;
  code: string;
  trigger: "selection" | "auto";
  diagnostics: EditorDiagnostic[];
}

/**
 * Where a finding came from. These are never blended:
 * - diagnostic: a language server or linter reported it.
 * - rule: a known risky pattern matched. It may still be intentional.
 * - ai: Claude suspects it. Never treated as confirmed.
 */
export type FindingSource = "diagnostic" | "rule" | "ai";
export type Confidence = "reported" | "high" | "medium" | "low";

export interface Finding {
  id: string;
  source: FindingSource;
  line: number;
  evidence: string;
  confidence: Confidence;
  /** Language-dependent text comes from the dictionary for rules. */
  ruleId?: string;
  title?: string;
  why?: string;
  how?: string;
  sideEffects?: string;
  find?: string;
  replace?: string;
}
