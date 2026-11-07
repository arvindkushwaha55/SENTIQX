# SENTIQX

**Your AI works. SENTIQX understands.**

SENTIQX is a floating Windows desktop companion. It shows which application you are in, explains in simple English or Hinglish what your AI coding assistant is really doing, and never pretends to know more than it does.

> **Status:** early development, Windows only. See [docs/LIMITATIONS.md](docs/LIMITATIONS.md) for what is verified and what is not.

## Features

| Feature | What it does |
| --- | --- |
| **Home** | Opens straight away, no folder needed. Shows the active app, its category and how much SENTIQX really knows about it. |
| **Claude Code monitoring** | Live status (Working, Waiting for user, Stuck, Error, Done), a three-line summary and recent activity, from official Claude Code hooks. |
| **Error explanations** | What happened, what it means, and whether you need to act, with the original details available. |
| **Communication Intelligence** | Paste a chat or email thread, review it, and get questions, action items, dates and pending replies. Runs locally and is rule-based. |
| **Intent Guard** | Check a message before it goes to the wrong app. You paste or copy the text yourself; Guard compares its shape (development prompt, formal email, personal note, secret-like) with the active app's category and only warns — it never sends, blocks or edits. See [docs/INTENT_GUARD.md](docs/INTENT_GUARD.md). |
| **Workspace zones** | Splits the screen into 2 halves or 4 quadrants and shows which app sits in the zone where SENTIQX is placed, with a mini grid of all zones. Opt-in, on top of app detection; a shared zone is shown as not clear instead of a guess. See [docs/ZONES.md](docs/ZONES.md). |
| **Live preview** | Shows your real local dev server (`localhost` only) inside the panel. |
| **Session history** | Stored locally in SQLite, with delete one and delete all. |
| **Floating window** | Native always-on-top with pin/unpin, drag, resize, hide to tray, and remembered position and size. |
| **Two languages** | English or Hinglish, one at a time. |

## Honesty rules

SENTIQX separates four levels for every app and never skips one:

1. **App detected:** it knows the name of the app in front.
2. **Context available:** an authorised data source is connected.
3. **Activity understood:** that source has actually delivered events.
4. **Integration unsupported:** no automatic source exists, and it says so.

It never invents progress percentages, completed work or fixes. Predictions are always labelled `Likely next:`, and "stuck" is only ever a suspicion.

## Privacy

- App detection stays off until you allow it, and reads only the app's name. Window titles need a separate opt-in.
- It does not read window contents, keystrokes or your screen, and it never monitors WhatsApp, Instagram or email in the background.
- From Claude Code hooks it keeps only event names, tool names, status, the session ID, the folder's name and a shortened error message. Prompts, commands and file contents are never read.
- History stores tool names, counts, error types, times and the folder name. It never stores raw error text.
- Pasted chats stay in memory and are analysed on your computer. A summary is saved only if you click save.
- Nothing is sent to any AI service or external server by these features.
- Secret hiding in pasted text is best effort, not a guarantee, so review the text first.

### What "Connect Claude Code" changes

Connecting adds temporary HTTP hooks to your user-level Claude settings file, `~/.claude/settings.json`. They point only at `127.0.0.1:47821` and carry a secret token. They are removed when you stop or close SENTIQX, or on the next launch after a crash. A backup is kept while you are connected, and the file is restored exactly if nothing else changed it.

## Getting started

### Requirements

- Windows 10 or 11 with WebView2
- [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/) with the MSVC toolchain
- Microsoft C++ Build Tools ("Desktop development with C++")
- [Claude Code](https://code.claude.com/docs), only for the monitoring feature

### Run in development

```powershell
pnpm install
pnpm tauri dev
```

### Build a standalone app

```powershell
pnpm tauri build --no-bundle
```

The app is created at `src-tauri\target\release\sentiqx.exe`. It runs on its own, without a dev server.

## Tests

```powershell
pnpm exec vitest run                  # frontend
pnpm exec tsc --noEmit                # type check
cd src-tauri
cargo test --lib                      # backend
cargo test --test real_claude -- --ignored --test-threads=1   # uses your real Claude login
```

## Tech stack

Tauri 2, Rust, React, TypeScript, Tailwind CSS and SQLite.

## Project layout

```text
src/
  components/         UI: Home, Claude, Intel, History, Settings, title bar
  lib/engine.ts       Status engine (events to the five statuses)
  lib/summary.ts      Three-line summaries and error explanations
  lib/appContext.ts   What can honestly be said about the active app
  lib/comms/          Communication Intelligence (parse, redact, analyse)
  lib/i18n.ts         English and Hinglish text
src-tauri/src/
  active_window.rs    Active application detection (Win32)
  receiver.rs         Local-only hook receiver
  normalize.rs        Reduces hook data to the minimum SENTIQX keeps
  settings_hooks.rs   Adds and removes hooks in Claude settings
  history.rs          SQLite session history
  privacy.rs          Saved permission choices
  window.rs           Pin, tray and show/hide
docs/LIMITATIONS.md   What is verified, and what is not
```

## Roadmap

- Optional AI summaries through an LLM provider, with redaction and clear consent
- Automatic dev-server detection for the live preview
- Installer for easy setup
- Research into Cursor and other tools, added only where a reliable, authorised source exists

## License

No license has been chosen yet. All rights reserved by the author.
