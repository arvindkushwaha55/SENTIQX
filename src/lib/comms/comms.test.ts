import { describe, expect, it } from "vitest";
import { analyse, findDates } from "./analyse";
import { parseChat, participantsOf } from "./parse";
import { HIDDEN, redact } from "./redact";

const ANDROID = `12/03/2024, 9:41 pm - Messages and calls are end-to-end encrypted.
12/03/2024, 9:41 pm - Asha: Hi team, the project deadline is 20/03/2024.
12/03/2024, 9:42 pm - Ravi: Can you share the design files tomorrow?
12/03/2024, 9:43 pm - Asha: I will send them by 5 pm.
Please also review the homepage.
12/03/2024, 9:50 pm - Ravi: <Media omitted>
12/03/2024, 9:55 pm - Ravi: Kya design team ka response aaya?
`;

describe("parseChat", () => {
  it("reads WhatsApp Android exports, joins continuation lines, drops system notices and media", () => {
    const m = parseChat(ANDROID);
    expect(m).toHaveLength(4);
    expect(m[0]).toMatchObject({ sender: "Asha", stamp: "12/03/2024 9:41 pm" });
    expect(m[2].text).toBe("I will send them by 5 pm.\nPlease also review the homepage.");
    expect(participantsOf(m)).toEqual(["Asha", "Ravi"]);
  });

  it("reads WhatsApp iOS exports", () => {
    const m = parseChat("[12/03/2024, 21:41:05] Asha: hello\n[12/03/2024, 21:42:00] Ravi: hi");
    expect(m.map((x) => x.sender)).toEqual(["Asha", "Ravi"]);
  });

  it("only trusts plain 'Name: text' when two or more names appear", () => {
    expect(parseChat("Asha: hi\nRavi: hello").map((x) => x.sender)).toEqual(["Asha", "Ravi"]);
    const single = parseChat("Note: remember the milk");
    expect(single[0].sender).toBeNull();
    expect(single[0].text).toContain("remember the milk");
  });

  it("never invents a sender for unstructured text", () => {
    expect(parseChat("just some pasted words").every((x) => x.sender === null)).toBe(true);
  });
});

describe("redact", () => {
  it("hides passwords, codes, keys and valid card numbers", () => {
    const r = redact("my password is hunter2 and otp 482913. key sk-abcdefghijklmnop1234. card 4111 1111 1111 1111");
    expect(r.text).not.toMatch(/hunter2|482913|abcdefghijklmnop|4111/);
    expect(r.text).toContain(HIDDEN);
    expect(r.count).toBeGreaterThanOrEqual(4);
  });

  it("leaves ordinary text and non-card numbers alone", () => {
    const t = "Meet at 5 pm on 12/03, order number 1234567890123456";
    const r = redact(t);
    expect(r.text).toBe(t);
    expect(r.count).toBe(0);
  });
});

describe("analyse", () => {
  const msgs = parseChat(ANDROID);

  it("finds questions, actions and dates that are actually in the text", () => {
    const a = analyse(msgs, null);
    expect(a.questions.map((q) => q.sender)).toEqual(["Ravi", "Ravi"]);
    expect(a.actions.length).toBeGreaterThanOrEqual(1);
    expect(a.dates.flatMap((d) => d.matches ?? [])).toEqual(expect.arrayContaining(["20/03/2024", "tomorrow", "5 pm"]));
    expect(a.messageCount).toBe(4);
    expect(a.firstStamp).toBe("12/03/2024 9:41 pm");
  });

  it("does not guess pending replies unless the user says who they are", () => {
    expect(analyse(msgs, null).pending).toBeNull();
  });

  it("lists what others asked after my last message", () => {
    const pending = analyse(msgs, "Asha").pending;
    expect(pending?.map((p) => p.sender)).toEqual(["Ravi"]);
    expect(pending?.[0].text).toContain("design team");
    expect(analyse(msgs, "Ravi").pending).toEqual([]);
  });

  it("quotes only text from the input", () => {
    const a = analyse(msgs, "Asha");
    const all = [...a.questions, ...a.actions, ...a.dates, ...a.important, ...(a.pending ?? [])];
    for (const i of all) expect(ANDROID.includes(i.text.split("\n")[0].replace(/\.\.\.$/, ""))).toBe(true);
  });

  it("finds Hinglish dates and requests", () => {
    expect(findDates("kal subah 10:30 par milte hain")).toEqual(expect.arrayContaining(["kal", "10:30"]));
    const a = analyse(parseChat("Asha: file bhej do\nRavi: theek hai, kar dunga"), null);
    expect(a.actions).toHaveLength(2);
  });

  it("returns empty results for empty input without throwing", () => {
    const a = analyse([], null);
    expect(a.messageCount).toBe(0);
    expect(a.questions).toEqual([]);
  });
});
