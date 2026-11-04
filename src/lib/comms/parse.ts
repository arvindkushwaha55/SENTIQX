import type { Msg } from "./types";

// WhatsApp (Android export): "12/03/2024, 9:41 pm - Asha: text"
const ANDROID = /^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]\.?m\.?)?)\s+-\s+([^:]{1,60}?):\s(.*)$/i;
// WhatsApp (iOS export): "[12/03/2024, 21:41:05] Asha: text"
const IOS = /^\[(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]\.?m\.?)?)\]\s+([^:]{1,60}?):\s(.*)$/i;
// Header with no sender (system notice): "12/03/2024, 9:41 pm - Messages are end-to-end encrypted."
const SYSTEM = /^\[?\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]\.?m\.?)?\]?\s+-?\s*[^:]*$/i;
// Plain "Name: text"
const PLAIN = /^([A-Za-zÀ-ɏ][^:\n]{0,40}?):\s+(\S.*)$/;

const NOISE = /^(<media omitted>|<attachment:.*>|this message was deleted|you deleted this message|image omitted|video omitted|sticker omitted)$/i;

function clean(text: string): string {
  // Strip invisible direction marks that exports add.
  return text.replace(/[‎‏‪-‮]/g, "").trim();
}

/** Splits pasted text into messages. Never invents a sender: unknown stays null. */
export function parseChat(raw: string): Msg[] {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const msgs: Msg[] = [];
  let headered = false;

  for (const rawLine of lines) {
    const line = clean(rawLine);
    if (!line) continue;
    const m = ANDROID.exec(line) ?? IOS.exec(line);
    if (m) {
      headered = true;
      msgs.push({ sender: clean(m[3]), text: clean(m[4]), stamp: `${m[1]} ${m[2]}` });
    } else if (SYSTEM.test(line) && /^\[?\d/.test(line)) {
      continue; // dated system notice such as "Messages are end-to-end encrypted"
    } else if (headered && msgs.length > 0) {
      msgs[msgs.length - 1].text += `\n${line}`; // continuation of the previous message
    } else {
      const p = PLAIN.exec(line);
      msgs.push(p ? { sender: clean(p[1]), text: clean(p[2]), stamp: null } : { sender: null, text: line, stamp: null });
    }
  }

  let out = msgs.filter((m) => m.text && !NOISE.test(m.text));

  // Plain "Name: text" is only trusted when at least two different names appear.
  if (!headered) {
    const names = new Set(out.map((m) => m.sender).filter(Boolean));
    if (names.size < 2) {
      out = out.map((m) => (m.sender ? { sender: null, text: `${m.sender}: ${m.text}`, stamp: null } : m));
    }
  }
  return out;
}

export function participantsOf(msgs: Msg[]): string[] {
  return [...new Set(msgs.map((m) => m.sender).filter((s): s is string => Boolean(s)))];
}
