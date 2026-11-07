# Intent Guard — design and Phase 1 implementation

Intent Guard helps prevent a message from going to the wrong application: a Claude
development prompt pasted into WhatsApp, a personal family message typed into a coding
tool, or a secret (password, API key) about to be sent to a chat app.

## Safety rules (non-negotiable)

- Guard **only warns**. It never sends, blocks, intercepts or edits a message.
- Guard only checks text the user **pastes in or copies themselves**. It does not read
  other applications, window contents or keystrokes, and there is no global keyboard hook.
- The message text is **never stored**. Secrets are hidden with the existing comms
  redactor before classification, and only their count is reported.
- Recipient/conversation identity is **not** claimed: the destination is the active
  application's category (from the existing, verified active-window detection), plus an
  optional manual choice when no app is detected.

## How Phase 1 works

1. **Intent classification** (`src/lib/intentGuard.ts`, pure + unit-tested): rule-based
   shapes — `coding-prompt`, `professional`, `personal`, `sensitive`, `unknown` — scored
   from imperative instruction patterns, code shape, technical vocabulary, formal-email
   shape, personal words and casual tone (English + Hinglish patterns, reusing the style
   of `src/lib/comms/analyse.ts`).
2. **Context matching**: intent × destination category. Only opposite-end mismatches
   warn (prompt → chat/browser, personal/formal → coding/terminal, secrets → anywhere
   outside coding tools).
3. **False-positive guards**: a coding *prompt* needs instruction shape **and** length/
   structure, so chatting about code with a friend stays silent; thresholds
   (Never / Only when sure / More often); a "This is fine" button suppresses exactly
   that intent + destination pair, stored locally.
4. **Warning**: an in-app card explaining *why* (reason codes turned into sentences in
   the selected language), plus an optional short WebAudio beep. English/Hinglish follow
   the existing one-language-at-a-time rule.

## What is verified

- The classifier and matcher are covered by unit tests (`src/lib/intentGuard.test.ts`),
  including the friend-chatting-about-code case and the feedback-suppression case.
- Destination detection reuses the already-verified active-window module.

## What is NOT verified / not built

- Not yet run inside the real Windows build; clipboard reading depends on WebView2
  focus/permission and falls back to paste with an honest message.
- No recipient-level detection (who a WhatsApp chat is with). Window titles could hint
  at it later, only for users who enabled titles — Phase 2 research, not a promise.
- No UI Automation reading of compose boxes (Phase 3 research). No LLM intent check.
- "Switch to the intended app" is not built; the warning names the destination only.

## Roadmap

- **Phase 2**: optional window-title recipient hint, switch-to-app action, per-app rules.
- **Phase 3 (research only)**: UI Automation for supported compose boxes, optional LLM
  intent check behind redaction + explicit consent.
