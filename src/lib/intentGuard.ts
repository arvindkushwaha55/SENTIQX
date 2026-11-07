import type { Category } from "./appContext";
import { redact } from "./comms/redact";

/**
 * Intent Guard (Phase 1): checks text the user is about to send against the kind of
 * application in front, and warns only on a high-confidence mismatch.
 *
 * Honesty rules, same as the rest of SENTIQX:
 * - The text is only ever text the user pasted here or copied themselves. Nothing is
 *   read from other apps, no keystrokes are captured, and the text is never stored.
 * - This is local and rule-based. It recognises shapes (an imperative development
 *   prompt, a formal email, a casual personal note, secret-looking strings), not meaning.
 * - It never blocks, sends or edits anything. It only advises.
 */

export type IntentKind = "coding-prompt" | "professional" | "personal" | "sensitive" | "unknown";

export interface IntentResult {
  kind: IntentKind;
  /** 0..1, how strongly the winning shape matched. */
  confidence: number;
  /** Signal codes that fired, for an honest explanation. */
  signals: string[];
  /** How many secret-looking strings were hidden before classification. */
  secretsHidden: number;
}

export type Threshold = "off" | "high" | "all";

export interface Mismatch {
  warn: boolean;
  intent: IntentKind;
  confidence: number;
  /** Reason codes the UI turns into a sentence. */
  reasons: string[];
  /** The kind of app this text looks meant for, when one is clear. */
  suggestedCategory: Category | null;
}

/** Imperative, instruction-shaped language aimed at an AI or a developer. */
const IMPERATIVE = [
  /\b(implement|refactor|debug|fix|create|build|write|generate|add|update|remove|delete|deploy|migrate|optimise|optimize)\b[^.?!]{0,80}\b(component|function|api|endpoint|bug|error|feature|file|class|module|hook|schema|query|test|tests|code|app|page|screen|button|form|database|server)\b/i,
  /\b(step by step|make sure|ensure that|do not|don't)\b[^.?!]{0,60}\b(use|change|modify|touch|break|add|remove)\b/i,
  /\b(please|pls)?\s*(implement|refactor|debug|fix|write|generate|create)\b/i,
  /\b(implement karo|fix karo|bana do|banao|code likho|error (fix|aa raha|a raha))\b/i,
];

const CODE_SHAPE = [
  /```/,
  /\b(function|const|let|var|class|import|export|return|def|public|private|void|async|await)\s+[\w({]/,
  /[{};]\s*$/m,
  /\b\w+\.(ts|tsx|js|jsx|py|rs|java|json|sql|css|html)\b/i,
  /(stack trace|traceback|at [\w$.]+\([\w.:]+\)|error:?\s+[A-Z]\w+Error)/i,
  /\b(npm|pnpm|yarn|git|cargo|pip)\s+(install|run|add|build|test|commit|push)\b/i,
];

const TECH_WORDS =
  /\b(component|frontend|backend|api|database|schema|endpoint|typescript|javascript|react|rust|python|sql|server|deploy|repository|repo|branch|commit|merge|bug|exception|null|undefined|async|interface|props|state|hook|query|compile|runtime|token|session|prompt)\b/gi;

const PROFESSIONAL = [
  /^(dear|respected|hello|hi)\s+(sir|madam|ma'am|team|all)\b/im,
  /\b(regards|sincerely|best regards|thank you for your|i am writing to|this is to inform|please find attached|kindly note|as discussed|per our conversation|meeting (is )?scheduled|invoice|quotation|proposal|deadline is|i would like to (request|apply)|application for|resignation|offer letter)\b/i,
  /\b(subject|to whom it may concern)\s*:/i,
  /\b(sir|madam|mahoday|mahodaya)\b/i,
];

const PERSONAL = [
  /\b(mummy|papa|mama|bhai|behen|didi|beta|beti|ghar|khaana|khana|maa|amma|abbu|family|shaadi|birthday|jaan|yaar|dost)\b/i,
  /\b(happy birthday|good (morning|night) (everyone|all|guys)|love you|miss you|kaisa hai|kaisi hai|kya haal|ghar (kab|aa|aana)|khana khaya|so jao|uth gaye|pahuch gaye|aaram kar)\b/i,
  /\b(call (me|karna|kr)|phone karna|message kar dena|ghar pe|kal milte|party (hai|mein))\b/i,
];

const CASUAL = /\b(bhai|yaar|are|abe|oye|na|haa|acha|accha|theek|matlab|wala|wali|kar de|kr de|ho gaya|kya scene)\b/i;

const count = (text: string, res: RegExp[]) => res.filter((re) => re.test(text)).length;
const hits = (text: string, re: RegExp) => text.match(re)?.length ?? 0;

/**
 * Classifies the shape of a message. Secrets are hidden first (reusing the comms
 * redactor) and never take part in matching beyond their count.
 */
export function classifyIntent(raw: string): IntentResult {
  const { text, count: secretsHidden } = redact(raw);
  const len = text.trim().length;
  const signals: string[] = [];

  if (secretsHidden > 0) signals.push("secret-like-text");

  const imperative = count(text, IMPERATIVE);
  const codeShape = count(text, CODE_SHAPE);
  const tech = hits(text, TECH_WORDS);
  const professional = count(text, PROFESSIONAL);
  const personal = count(text, PERSONAL);
  const casual = CASUAL.test(text) ? 1 : 0;

  if (imperative > 0) signals.push("imperative-instructions");
  if (codeShape > 0) signals.push("code-shape");
  if (tech >= 3) signals.push("technical-vocabulary");
  if (professional > 0) signals.push("formal-email-shape");
  if (personal > 0) signals.push("personal-words");
  if (casual > 0) signals.push("casual-tone");

  // A secret on its own is the strongest, clearest signal there is.
  if (secretsHidden > 0 && imperative === 0 && professional === 0) {
    return { kind: "sensitive", confidence: 0.9, signals, secretsHidden };
  }

  // Coding prompt: instruction shape plus technical substance. Short casual chat
  // about code ("function wala doubt kal clear karna") must NOT qualify — that is a
  // normal conversation with a friend, so length and structure both matter.
  const promptScore = imperative * 2 + codeShape * 2 + Math.min(tech, 4);
  const promptShaped = len >= 120 || codeShape >= 2 || (imperative >= 1 && len >= 80);
  if (imperative > 0 && promptShaped && promptScore >= 5 && tech >= 2) {
    return { kind: "coding-prompt", confidence: Math.min(0.6 + promptScore / 20, 0.95), signals, secretsHidden };
  }

  if (professional >= 1 && professional >= personal) {
    return { kind: "professional", confidence: Math.min(0.6 + professional / 5, 0.9), signals, secretsHidden };
  }

  if (personal > 0 || (casual > 0 && tech <= 1 && imperative === 0)) {
    // A long structured text is rarely a casual personal note.
    if (len < 400) return { kind: "personal", confidence: personal > 0 ? 0.8 : 0.65, signals, secretsHidden };
  }

  return { kind: "unknown", confidence: 0.3, signals, secretsHidden };
}

const HOME_CATEGORY: Record<IntentKind, Category | null> = {
  "coding-prompt": "coding",
  professional: "communication", // email lives in a communication app, but not a chat
  personal: "communication",
  sensitive: null,
  unknown: null,
};

/**
 * Compares an intent with the destination category. Only clear, opposite-end
 * mismatches warn; everything debatable stays silent by design.
 */
export function assessMismatch(intent: IntentResult, dest: Category): Mismatch {
  const base: Mismatch = {
    warn: false,
    intent: intent.kind,
    confidence: intent.confidence,
    reasons: [],
    suggestedCategory: HOME_CATEGORY[intent.kind],
  };

  // Secrets warn anywhere outside a coding tool too, but the reason is different:
  // the risk is the secret itself, not the destination shape.
  if (intent.secretsHidden > 0 && dest !== "coding" && dest !== "terminal") {
    return { ...base, warn: true, reasons: ["secret-like-text", "secret-destination"] };
  }

  switch (intent.kind) {
    case "coding-prompt":
      if (dest === "communication") return { ...base, warn: true, reasons: ["prompt-shape", "chat-destination"] };
      if (dest === "browser") return { ...base, warn: true, reasons: ["prompt-shape", "browser-destination"] };
      return base;
    case "personal":
      if (dest === "coding" || dest === "terminal")
        return { ...base, warn: true, reasons: ["personal-shape", "coding-destination"] };
      return base;
    case "professional":
      if (dest === "coding" || dest === "terminal")
        return { ...base, warn: true, reasons: ["formal-shape", "coding-destination"] };
      return base;
    default:
      return base;
  }
}

/** Applies the user's threshold and their "this was fine" feedback. */
export function shouldWarn(m: Mismatch, dest: Category, threshold: Threshold, suppressed: string[]): boolean {
  if (!m.warn || threshold === "off") return false;
  if (suppressed.includes(suppressKey(m.intent, dest))) return false;
  if (threshold === "high") return m.confidence >= 0.75 || m.reasons.includes("secret-like-text");
  return m.confidence >= 0.5;
}

/** Feedback is remembered per intent + destination pair, never more broadly. */
export const suppressKey = (intent: IntentKind, dest: Category) => `${intent}->${dest}`;

/** One full check: classify, match, threshold. Pure, so the UI stays thin. */
export function checkText(
  text: string,
  dest: Category,
  threshold: Threshold,
  suppressed: string[],
): { intent: IntentResult; mismatch: Mismatch; warn: boolean } {
  const intent = classifyIntent(text);
  const mismatch = assessMismatch(intent, dest);
  return { intent, mismatch, warn: shouldWarn(mismatch, dest, threshold, suppressed) };
}
