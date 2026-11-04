# SENTIQX: what is verified and what is not

Last checked on 4 November 2026 against Claude Code 2.1.317 on Windows 11 with the release build.

## How the app gets its information

**Active application.** Documented Win32 calls (`GetForegroundWindow`, `QueryFullProcessImageNameW`, `GetWindowTextW`), polled every 0.7 seconds while detection is on. This gives the app's name and, if you allow it, the window title. It does not give the app's content. Windows UI Automation could read content from some apps, but SENTIQX does not use it yet.

**Claude Code.** Temporary HTTP hooks in your user-level `~/.claude/settings.json`, posting to `127.0.0.1:47821/event` with a per-run secret token. They are removed on Stop, on app exit, and on the next launch after a crash.

Only these hook fields are read: event name, session ID, tool name, tool-use ID, interrupt flag, the working folder's last name, and a shortened error message for failures. Prompts, tool input, tool output and file contents are never read.

## Verified on the real app

| Check | How it was tested | Result |
| --- | --- | --- |
| Opens with no folder | Launched the release build | Opens straight to Home |
| App detection and switching | Temporary cmd, Chrome and VS Code windows, plus charmap | Correct name and category each time |
| Stays above other apps while pinned | Each window placed exactly over SENTIQX and brought to the front | SENTIQX stayed above, same window, not minimised |
| Pin is real | Unpinned through the UI | Windows topmost flag cleared, saved, and restored on re-pin |
| Does not take keyboard focus | Typed into another window | Text arrived there, SENTIQX did not take focus |
| Resize | Windows hit-test at the corner | Native resize corner (17) |
| Drag | Real mouse drag on the title bar | Moved the exact expected distance |
| Remembers position and size | Set them, closed, reopened | Identical |
| Hide and show | Hide button, then the tray's left-click message sent directly | Hidden while still running, then shown again |
| Unsupported apps | charmap | Says "Integration unsupported" and invents nothing |
| English and Hinglish | Switched in Settings | One language at a time |
| Performance | 15 seconds idle with detection on | About 0.5% CPU, about 270 MB across WebView2 processes |

## Verified with the real `claude` CLI

These use `claude -p`, not the VS Code panel. Run them with `cargo test --test real_claude -- --ignored --test-threads=1`.

- Events arrive in order: prompt, tool start, tool end, turn stop, session end.
- A failing tool is reported as failed.
- Events arrive with no folder chosen. This used a temporary settings file passed with `--settings`.
- The settings file is restored byte for byte after hooks are removed.
- Claude keeps working when SENTIQX is not running, and when the token is wrong.

## Not verified yet

- **The Connect button with your real settings file.** Automated tests deliberately do not touch `~/.claude/settings.json`, so this needs one manual try.
- **The VS Code panel.** The hook tests use the CLI. Older public reports say some hook events did not fire in the panel, so the app shows a hint if no event arrives within 20 seconds.
- **Permission prompts (`PermissionRequest`) in a real session.** The status logic is unit-tested only.
- **Notifications appearing on screen.** The decision logic is unit-tested. Whether Windows displays them from the unpackaged exe has not been seen, and an installer may be needed.
- **A real click on the tray icon.** The test sent the same message Windows sends, without a physical click.
- **Your own Chrome and VS Code profiles.** Tests used temporary profiles so your windows were not touched.

## Known limits

- SENTIQX does not read browser tabs, chats or any window's content. Browsers and communication apps show as "Integration unsupported", with a link to the preview or to Communication Intelligence.
- Claude activity comes from all Claude sessions on the computer, not from the window in front. A project filter in Settings can narrow this to one folder.
- `SessionStart` does not support HTTP hooks, so a session is recognised from its first event.
- `Stop` does not fire when you interrupt Claude. The status then shows working, followed by "suspected stuck". It never shows Done.
- If you deny a permission prompt, no event announces it, so WAITING FOR USER can stay until the next event.
- STUCK is only ever a suspicion: 90 seconds without events, or 5 minutes while a tool is running.
- Progress percentages are never shown, because hooks do not provide them.
- "Current task" is the kind of action, such as running a command. SENTIQX does not read task names.
- Another always-on-top window can still cover SENTIQX, because Windows orders topmost windows among themselves. Exclusive full-screen apps may also cover it.
- The live preview needs a local address typed in by hand. A page that blocks embedding stays blank.
- WebView2 is what uses most of the memory.

## Communication Intelligence is not AI yet

It is local and rule-based. It finds question marks, request phrases, dates and frequently used words, and quotes only text you pasted. It cannot write a meaning-based summary like "the team discussed the deadline", because no AI model is connected. It says this on screen. Instagram has no export format of its own in the parser, so pasted text from it is read as plain or `Name: text` messages.

## Not built yet

- AI summaries through an LLM provider, with redaction and consent
- Automatic detection of local dev servers
- Reading app content through UI Automation
- Installer
