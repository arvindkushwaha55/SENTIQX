# SENTIQX: what is verified and what is not

Last verified against Claude Code 2.1.317 on Windows 11.

## How activity is read
SENTIQX adds temporary **HTTP hooks** to `<project>/.claude/settings.local.json`
(documented Claude Code feature). Each hook POSTs to `127.0.0.1:47821/event` with a
per-run secret token. Hooks are removed on Stop, on app exit, and (if the app crashed)
on the next launch. A backup of an existing settings file is kept next to it
(`settings.local.json.sentiqx-backup`).

Only these fields are read from a hook payload: event name, session id, tool name,
tool-use id, interrupt flag, and for failures a truncated error string. Prompts, tool
inputs, tool outputs and file contents are never read or stored.

## Verified with the real `claude` CLI (headless, `claude -p`)
- Events arrive in order: prompt, tool start, tool end, turn stop, session end.
- A failing tool is reported as failed.
- Claude keeps working normally when SENTIQX is not running, and when the token is wrong.
- Events from other projects, or while paused, are dropped.

Run again with: `cargo test --test real_claude -- --ignored --test-threads=1`

## Not verified yet
- **The VS Code panel.** The tests above use the CLI. Earlier public reports say some
  hook events did not fire in the VS Code panel on some versions. The app shows a hint
  when no event arrives after 20 seconds. Needs a manual check in the panel.
- Permission prompts (`PermissionRequest`): not exercised in the automated tests.

## Known limits (documented by Claude Code, or inherent)
- `SessionStart` does not support HTTP hooks, so a session is inferred from its first event.
- `Stop` does not fire when the user interrupts. After an interrupt the status shows
  working, then "suspected stuck" after the inactivity limit. It is never shown as DONE.
- If the user denies a permission prompt, no event announces it, so WAITING FOR USER can
  stay until the next event.
- STUCK is always only *suspected* (90 s without events, 5 min while a tool is running).
- Progress percentages are never shown: the hooks do not provide any.
- The hook timeout is 2 seconds, so a slow SENTIQX can never hold Claude up for long.
