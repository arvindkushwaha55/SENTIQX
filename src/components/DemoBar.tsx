import type { Dispatch } from "react";
import type { Action } from "../lib/engine";
import type { ActivityEvent } from "../lib/types";

/**
 * Development-only helper to review each state visually. It never ships in a
 * production build, and the UI shows a DEMO banner whenever it is switched on.
 */
export function DemoBar({ dispatch, active }: { dispatch: Dispatch<Action>; active: boolean }) {
  if (!active) return null;

  const send = (events: ActivityEvent[]) => {
    dispatch({ type: "monitor", action: "stop", at: Date.now() });
    dispatch({ type: "monitor", action: "start", at: Date.now() });
    events.forEach((event) => dispatch({ type: "event", event }));
  };
  const t = Date.now();

  const scenarios: [string, ActivityEvent[]][] = [
    [
      "Working",
      [
        { kind: "prompt", at: t - 4000 },
        { kind: "tool_start", at: t - 3000, tool: "Write", id: "w1" },
        { kind: "tool_end", at: t - 2000, tool: "Write", id: "w1", ok: true },
        { kind: "tool_start", at: t - 500, tool: "PowerShell", id: "p1" },
      ],
    ],
    [
      "Waiting",
      [
        { kind: "prompt", at: t - 3000 },
        { kind: "permission_request", at: t - 1000, tool: "Write" },
      ],
    ],
    [
      "Stuck",
      [
        { kind: "prompt", at: t - 130_000 },
        { kind: "tool_start", at: t - 125_000, tool: "Read", id: "r1" },
        { kind: "tool_end", at: t - 124_000, tool: "Read", id: "r1", ok: true },
      ],
    ],
    [
      "Tool error",
      [
        { kind: "prompt", at: t - 4000 },
        { kind: "tool_start", at: t - 3000, tool: "PowerShell", id: "e1" },
        { kind: "tool_end", at: t - 2000, tool: "PowerShell", id: "e1", ok: false, error: "Cannot find path 'C:\\missing' because it does not exist." },
      ],
    ],
    [
      "API error",
      [
        { kind: "prompt", at: t - 3000 },
        { kind: "api_error", at: t - 1000, errorType: "rate_limit", detail: "429 Too Many Requests" },
      ],
    ],
    [
      "Done",
      [
        { kind: "prompt", at: t - 5000 },
        { kind: "tool_start", at: t - 4000, tool: "Write", id: "d1" },
        { kind: "tool_end", at: t - 3000, tool: "Write", id: "d1", ok: true },
        { kind: "turn_stop", at: t - 500 },
      ],
    ],
  ];

  return (
    <div className="flex flex-wrap gap-1 border-t border-dashed border-[var(--line)] px-3 py-2">
      {scenarios.map(([name, events]) => (
        <button
          key={name}
          type="button"
          onClick={() => send(events)}
          className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] text-[var(--muted)] hover:text-[var(--text)]"
        >
          {name}
        </button>
      ))}
    </div>
  );
}
