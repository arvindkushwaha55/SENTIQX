# SENTIQX: handoff and plan

Written on 11 Nov 2026 so another assistant can continue this project. It covers what was asked, what was built, what is verified, what is unfinished, and what to do next, in order.

## 0. Read this first

- **Owner:** Arvind, a beginner. He writes in Hinglish. Reply in simple Hinglish, one small step at a time, and do as much as possible yourself. Never ask him for passwords or tokens.
- **Repository:** `C:\Users\arvin\Desktop\SENTIQX` on Windows 11, using PowerShell. The private GitHub repo is `arvindkushwaha55/SENTIQX` on branch `main`.
- **Uncommitted work:** the whole Smart Debug feature is on disk but not committed. Review it, then commit (section 5, step 1).
- **Honesty rule:** never fake activity, progress, percentages or "it works". Say clearly what was verified and what was not. `docs/LIMITATIONS.md` follows this rule.
- **Do not edit `~/.claude/settings.json` in tests.** Claude Code's auto mode blocked that once. Tests use a temporary settings file passed with `claude --settings`. Only the app's Connect button writes the real file, and only when the user clicks it.
- **Do not send keystrokes or clicks to the user's own windows.** That was blocked too. Use your own test windows, temporary profiles, or the app's local debug port (section 4).

## 1. What SENTIQX is

SENTIQX is a floating, always-on-top Windows companion:

- It shows which application is in front of you.
- It explains in English or Hinglish what Claude Code is doing, using five statuses: WORKING, WAITING FOR USER, STUCK, ERROR, DONE.
- It summarises pasted chats, previews local websites, and keeps a local history.
- It helps debug selected code from VS Code.
- It is privacy-first: everything needs permission, and nothing is invented.

## 2. History: what was asked and what was done

| # | What Arvind asked | What was done | Commit |
| --- | --- | --- | --- |
| 1 | Long product spec: monitor Claude Code, 5 statuses, Hinglish, preview, history. Assess first. | Feasibility research on Claude Code hooks, OpenTelemetry and transcripts. Chosen approach: official **HTTP hooks** | none |
| 2 | Create a GitHub repo, private | Created the repo and scaffolded Tauri 2, React, TypeScript and Tailwind | `dea141a` |
| 3 | The window does not stay on top | Added a pin toggle | `f3cec15` |
| 4 | "Continue, give your best" | Status engine, English and Hinglish text, summaries, error explanations, first UI | `75dbbbf` |
| 5 | "Work carefully" | Claude Code connector: Rust HTTP receiver, settings installer, live events, real-Claude end-to-end tests | `60cf7ac` |
| 6 | Upgrade: futuristic UI, fixed floating window, Communication Intelligence | Frameless window with native topmost, tray, remembered position and size, full redesign, Intel tab | `f816a49` |
| 7 | Desktop-wide companion: no folder picker, detect the active app, Home screen; folder may stay optional | Win32 active-app detection behind a permission, Home tab, hooks moved to user level, optional project filter | `f816a49` |
| 8 | Write a README | README, SQLite history, notifications, lifecycle log, honest limitations | `4e09eb8` |
| 9 | Test the Connect button for real | Verified with real terminal events. Settings file restored byte for byte after Stop | `29b1328` |
| 10 | Smart Debug Intelligence | Built and partly tested. **The end-to-end test was stopped by the user and is uncommitted** | none |
| 11 | Read-only project audit | Report given in chat. Findings are in section 6 | none |

## 3. Architecture

```text
Claude Code --HTTP hook--> receiver.rs (127.0.0.1:47821, secret token)
                             -> normalize.rs (keeps only safe fields)
                             -> history.rs (SQLite) and "activity" event -> engine.ts -> UI

Windows foreground --> active_window.rs (polls every 0.7 s, only after permission) -> "active-app" -> Home

VS Code extension --> receiver /editor/* --> editor.rs --> DebugView
                       local rules (rules.ts), "Review with Claude" -> debug_ai.rs -> `claude -p` with no tools
                       an approved fix goes back to the extension -> diff preview -> second approval in VS Code

Pasted chat --> src/lib/comms (redact, parse, analyse) --> Intel tab (frontend only)
```

### Key files

| File | Purpose |
| --- | --- |
| `src-tauri/src/lib.rs` | App setup, all Tauri commands, wiring |
| `src-tauri/src/receiver.rs` | Local HTTP server. Token check. Routes `/event`, `/editor/context`, `/editor/result`, `/editor/pending` |
| `src-tauri/src/normalize.rs` | Reduces hook JSON to event name, session, tool, ok/fail, folder name. Prompts and commands are never read |
| `src-tauri/src/settings_hooks.rs` | Adds and removes hooks in `~/.claude/settings.json` with a backup and exact restore |
| `src-tauri/src/active_window.rs` | Active app name and category (Win32) |
| `src-tauri/src/window.rs` | Pin, tray, show and hide |
| `src-tauri/src/history.rs` | SQLite history (`%APPDATA%\com.sentiqx.app\history.db`) |
| `src-tauri/src/privacy.rs`, `lifecycle.rs` | Saved permission choices, and a log of why the app started or closed |
| `src-tauri/src/editor.rs`, `debug_ai.rs` | Smart Debug bridge and AI review (**uncommitted**) |
| `src/App.tsx` | Frontend wiring. Tabs: Home, Claude, Debug, Intel, History, Settings |
| `src/lib/engine.ts` | Turns events into the five statuses |
| `src/lib/summary.ts`, `appContext.ts` | Three-line summaries, and an honest description of the active app |
| `src/lib/i18n.ts` | All English and Hinglish text in one typed `Dict` |
| `src/lib/comms/*` | Communication Intelligence (rule-based, not AI) |
| `src/lib/debug/*` | Smart Debug rules, AI answer validation, diff (**uncommitted**) |
| `vscode-extension/` | VS Code bridge, plain JavaScript (**uncommitted, not packaged**) |
| `docs/LIMITATIONS.md`, `README.md` | What is verified and what is not. Both still need the Debug feature added |

## 4. How to build, run and test

```powershell
# Rust lives in the user PATH. Refresh it in each new shell:
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')

pnpm exec tsc --noEmit                          # type check
pnpm exec vitest run                            # frontend tests (last run: 115 passed)
cd src-tauri; cargo clippy --all-targets        # was clean
cargo test --lib                                # last run: 48 passed
cargo test --test real_claude -- --ignored --test-threads=1     # real Claude CLI; rerun this (see section 6)
cargo test --test debug_ai_real -- --ignored --test-threads=1   # real Claude review; last run: 4 passed
cd ..; pnpm tauri build --no-bundle             # creates src-tauri\target\release\sentiqx.exe (about 3-8 min)
```

### UI testing without touching the user's screen

Start the release exe with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9333 --remote-allow-origins=*'`. Then drive the app's own WebView over the Chrome DevTools Protocol from Node: Node 24 has a built-in `WebSocket`. Use it to click buttons and take screenshots.

Restart the app without that variable when you are done.

### Known traps

- `cargo build --release` alone does not embed the frontend. Always use `pnpm tauri build`.
- Port 1420 can stay busy after a dev run is killed.
- `pnpm tauri dev` ends when the shell session ends, and the window disappears with it. Use the release exe for anything long.
- The project uses ES2020, so `Array.prototype.at` breaks the build. Use `arr[arr.length - 1]`.
- HTTP hooks cannot be used for `SessionStart`, and `Stop` does not fire on an interrupt. Both are documented by Claude Code.

## 5. Next steps, in this order

1. **Secure the Smart Debug work.**
   - Read the uncommitted files (`git status`).
   - Run `tsc`, `vitest`, `clippy` and `cargo test --lib`.
   - Commit with a clear message, then push.
2. **Fix the multi-session bug in `src/lib/engine.ts`.**
   - The engine merges every Claude session on the computer into one state. A `session_end` from another session sets `sessionActive = false` and can hide the live status.
   - Make the state per session, with `sessionId` as the key. Show the most recently active session, and optionally list the others.
   - Add unit tests for two sessions running at once.
3. **Prove the core flow on a real screen.**
   - Rerun `real_claude`: `receiver.rs` changed after its last run.
   - With the user, click Connect. Send a message from a terminal Claude session, then from the **VS Code panel**.
   - Confirm that the status changes on screen: WORKING, then DONE. Use history (`history.db`) and the debug port as evidence.
   - The VS Code panel is still unverified: only one `session_end` event has been seen from it. The user's panel runs in auto mode, so WAITING needs default permission mode to test.
4. **Finish Smart Debug end to end.**
   - The test files are `vscode-extension/test/run.js` and the old scratchpad driver `drive-debug.mjs`. Recreate the driver if it is missing.
   - Run VS Code with `--extensionDevelopmentPath`, `--extensionTestsPath`, and a temporary `--user-data-dir` and `--extensions-dir`.
   - Verify these cases: no selection, permission refused, real TypeScript diagnostics, a decline in VS Code, apply, undo, a stale file refused, and auto-suggestions off and on.
   - Package the extension with `pnpm dlx @vscode/vsce package --no-dependencies` inside `vscode-extension/`. Install the `.vsix` only with the user's OK.
5. **Small gaps.**
   - Hardcoded English: the "Status" label in `StatusHero.tsx`, the tray menu in `window.rs`, and Rust error strings.
   - Set a real CSP in `tauri.conf.json`, which is `null` now. Keep the localhost preview iframe working.
   - Update `README.md` and `docs/LIMITATIONS.md` for Smart Debug.
   - Branding: the app and tray icons are still the Tauri defaults, and `Cargo.toml` still has `description = "A Tauri App"` and `authors = ["you"]`.
   - Remove unused items: the `core:window:allow-minimize` permission, `public/tauri.svg` and `public/vite.svg`.
6. **Make it usable for others.**
   - Build an installer (`pnpm tauri build`, a bundle) and check that notifications really appear.
   - Measure CPU and RAM again after Smart Debug.
   - Add a React error boundary.
7. **Bigger features, later.**
   - Real AI summaries for monitoring and chats through an LLM provider, with redaction and consent. Today, Communication Intelligence is rule-based.
   - Automatic detection of local dev servers for the preview.
   - Research Cursor and other AI tools. Add them only with a reliable, authorised data source.

## 6. Status summary from the audit

| Status | Features |
| --- | --- |
| Verified | Launch with no folder; always-on-top and pin; drag, resize and remembered position; active-app detection (cmd, Chrome, VS Code, charmap); focus never stolen |
| Partial | Claude integration (terminal verified, VS Code panel not); activity monitoring (multi-session bug); summaries (rule-based); preview (URL typed by hand); English/Hinglish (a few English leftovers); SQLite history (UI list not seen populated); Communication Intelligence (rule-based); privacy (CSP null); performance |
| Built, not verified | Five-status display with real events; Smart Debug; fix and diff apply in VS Code |
| Planned only | Multi-AI support |

**Stage:** the upper end of a basic prototype. It becomes an MVP after steps 1 to 4.

## 7. Privacy rules to keep

- Off by default. Ask before reading anything.
- Window titles need a separate opt-in.
- From hooks, keep only the event name, tool, status, session ID and folder name. Never prompts, commands or output.
- History never stores raw error text.
- Pasted chats stay in memory. Saving them is opt-in.
- Code goes to Claude only after a click on "Review with Claude". Secrets are hidden first, Claude gets no tools, and every AI finding must quote real code or it is dropped.
- Fixes need two approvals, one in SENTIQX and one in VS Code. Files are never saved automatically.
- Never claim a fix works without running it.
