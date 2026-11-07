import { describe, expect, it } from "vitest";
import { assessMismatch, checkText, classifyIntent } from "./intentGuard";

const PROMPT =
  "Implement the login component in src/auth/Login.tsx. Add form validation, make sure you do not break the existing API integration, run the tests and fix any error that comes up. Use TypeScript and keep the component small.";

describe("classifyIntent", () => {
  it("recognises a development prompt", () => {
    const r = classifyIntent(PROMPT);
    expect(r.kind).toBe("coding-prompt");
    expect(r.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it("does not call casual code chat with a friend a prompt", () => {
    const r = classifyIntent("bhai kal function wala doubt clear kar dena, aaj ho gaya mera kaam");
    expect(r.kind).not.toBe("coding-prompt");
  });

  it("recognises a formal email shape", () => {
    const r = classifyIntent(
      "Dear Sir, I am writing to request leave for two days. Please find attached my application. Regards, Arvind",
    );
    expect(r.kind).toBe("professional");
  });

  it("recognises a personal message", () => {
    const r = classifyIntent("Mummy khana khaya? Papa ghar kab aa rahe hain, call karna please");
    expect(r.kind).toBe("personal");
  });

  it("treats a lone secret as sensitive", () => {
    const r = classifyIntent("mera password hai Tiger#4821 sambhal ke rakhna");
    expect(r.kind).toBe("sensitive");
    expect(r.secretsHidden).toBeGreaterThan(0);
  });

  it("stays unknown for a tiny neutral text", () => {
    expect(classifyIntent("ok").kind).toBe("unknown");
  });
});

describe("assessMismatch + thresholds", () => {
  it("warns when a development prompt is headed for a chat app", () => {
    const r = checkText(PROMPT, "communication", "high", []);
    expect(r.warn).toBe(true);
    expect(r.mismatch.reasons).toContain("chat-destination");
  });

  it("stays silent when the same prompt goes to a coding app", () => {
    expect(checkText(PROMPT, "coding", "high", []).warn).toBe(false);
  });

  it("warns when a personal message is headed for a coding app", () => {
    const r = checkText("Mummy khana khaya? Papa ghar kab aa rahe hain, call karna please", "coding", "high", []);
    expect(r.warn).toBe(true);
  });

  it("warns about secrets headed for a chat app even at the high threshold", () => {
    const r = checkText("ye le api key token hai sk-abcdefgh1234567890XYZ sambhal ke", "communication", "high", []);
    expect(r.warn).toBe(true);
  });

  it("never warns when the threshold is off", () => {
    expect(checkText(PROMPT, "communication", "off", []).warn).toBe(false);
  });

  it("respects 'this was fine' feedback for that exact pair only", () => {
    expect(checkText(PROMPT, "communication", "high", ["coding-prompt->communication"]).warn).toBe(false);
    expect(checkText(PROMPT, "browser", "high", ["coding-prompt->communication"]).warn).toBe(true);
  });

  it("does not warn on unknown text anywhere", () => {
    expect(assessMismatch(classifyIntent("ok done"), "communication").warn).toBe(false);
  });
});
