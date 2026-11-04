import { participantsOf } from "./parse";
import type { Analysis, Item, Msg } from "./types";

/**
 * Local, rule-based analysis. It looks for explicit signals in the text (question marks,
 * request phrases, date and time words). It does not understand meaning, so it can miss
 * things, and it never writes anything that is not in the pasted text.
 */

const QUESTION_START = /^(kya|kab|kahan|kaha|kaun|kyun|kyu|kaise|kitna|kitne|what|when|where|who|why|how|can you|could you|will you|would you|do you|did you|are you|is it)\b/i;

const ACTION: RegExp[] = [
  /\b(please|pls|plz)\b.{0,60}\b(send|share|check|review|update|confirm|reply|call|fix|finish|complete|submit|prepare|book|arrange|look)\b/i,
  /\b(need to|needs to|have to|has to|must|should|todo|to-do|action item|remember to|don'?t forget|make sure|follow up|pending)\b/i,
  /\b(i will|i'll|we will|we'll|will send|will share|will do|let me)\b/i,
  /\b(kar do|kar dena|karna hai|karna h|bhej do|bhej dena|bhejna|dekh lo|dekh lena|bata dena|batana|yaad rakh|dena hai|lena hai|karenge|karunga|kar dunga|bhej dunga|zaroor|jaldi)\b/i,
];

const MONTHS = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const DATE_PATTERNS: RegExp[] = [
  /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g,
  /\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g,
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})\\b`, "gi"),
  new RegExp(`\\b(?:${MONTHS})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, "gi"),
  /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|somvar|mangalvar|budhvar|guruvar|shukravar|shanivar|ravivar)\b/gi,
  /\b(?:today|tomorrow|tonight|next week|this week|next month|aaj|kal|parso|agle hafte|is hafte|agle mahine)\b/gi,
  /\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/gi,
  /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g,
  /\b(?:deadline|due date|due by)\b/gi,
];

const IMPORTANT_WORDS = /\b(deadline|urgent|important|asap|final|confirmed?|decid(?:e|ed)|agree(?:d)?|approv(?:e|ed)|meeting|payment|invoice|budget|launch|release|issue|problem|blocked|risk|deliver(?:y|ed)?|demo|zaroori|zaruri|pakka|kal tak|jaldi)\b/gi;

const STOPWORDS = new Set(
  (
    "the and for are but not you your with that this have has had was were will would could should from they them their there here what when where which who whom how why about into over after before then than also just like more most some any each other such only very can cant dont does did done get got let its ours " +
    "hai hain tha thi the ho hoga hogi kya kab kahan kaha kaun kyun kyu kaise aur lekin par pe ka ki ke ko se me mein bhi toh to ye yeh wo woh hum aap tum mera meri mere tera teri apna apni abhi phir kuch sab bahut thoda zyada kar karo kiya karna raha rahi rahe wala wali"
  ).split(/\s+/),
);

const clip = (s: string, n = 220) => (s.length > n ? `${s.slice(0, n).trimEnd()}...` : s);
const item = (m: Msg, matches?: string[]): Item => ({ sender: m.sender, text: clip(m.text), matches });

const isQuestion = (t: string) => t.includes("?") || QUESTION_START.test(t.trim());
const isAction = (t: string) => ACTION.some((re) => re.test(t));

export function findDates(text: string): string[] {
  const found = new Set<string>();
  for (const re of DATE_PATTERNS) {
    for (const m of text.matchAll(new RegExp(re.source, re.flags))) found.add(m[0].trim());
  }
  return [...found];
}

function importanceScore(m: Msg): number {
  let score = 0;
  score += 2 * (m.text.match(IMPORTANT_WORDS)?.length ?? 0);
  if (findDates(m.text).length > 0) score += 1;
  if (isQuestion(m.text)) score += 1;
  if (m.text.length > 80) score += 1;
  return score;
}

export function frequentWords(msgs: Msg[], limit = 6): string[] {
  const counts = new Map<string, number>();
  for (const m of msgs) {
    for (const w of m.text.toLowerCase().match(/[a-zÀ-ɏ]{4,}/g) ?? []) {
      if (!STOPWORDS.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([w]) => w);
}

/** `me` is the participant the user says they are; without it pending replies are not guessed. */
export function analyse(msgs: Msg[], me: string | null): Analysis {
  const stamps = msgs.map((m) => m.stamp).filter((s): s is string => Boolean(s));

  const questions = msgs.filter((m) => isQuestion(m.text)).map((m) => item(m));
  const actions = msgs.filter((m) => isAction(m.text)).map((m) => item(m));
  const dates = msgs
    .map((m) => ({ m, d: findDates(m.text) }))
    .filter((x) => x.d.length > 0)
    .map((x) => item(x.m, x.d));

  const important = msgs
    .map((m, i) => ({ m, i, s: importanceScore(m) }))
    .filter((x) => x.s >= 2)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, 5)
    .sort((a, b) => a.i - b.i)
    .map((x) => item(x.m));

  let pending: Item[] | null = null;
  if (me) {
    const lastMine = msgs.reduce((acc, m, i) => (m.sender === me ? i : acc), -1);
    pending = msgs
      .filter((m, i) => i > lastMine && m.sender !== null && m.sender !== me && (isQuestion(m.text) || isAction(m.text)))
      .map((m) => item(m));
  }

  return {
    messageCount: msgs.length,
    participants: participantsOf(msgs),
    firstStamp: stamps[0] ?? null,
    lastStamp: stamps.length > 0 ? stamps[stamps.length - 1] : null,
    questions,
    actions,
    dates,
    important,
    pending,
    frequentWords: frequentWords(msgs),
  };
}
