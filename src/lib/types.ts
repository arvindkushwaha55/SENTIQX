export type Status = "working" | "waiting" | "stuck" | "error" | "done";
export type MonitorState = "off" | "on" | "paused";
export type Language = "en" | "hinglish";
export type ToolKind = "edit" | "run" | "read" | "web" | "agent" | "other";

/**
 * Normalised activity events. The Claude Code connector (next stage) will
 * translate real hook events into these. Nothing outside this union can change
 * what SENTIQX shows, so the UI can never display activity that was not reported.
 */
export type ActivityEvent =
  | { kind: "session_start"; at: number }
  | { kind: "prompt"; at: number }
  | { kind: "tool_start"; at: number; tool: string; id?: string }
  | {
      kind: "tool_end";
      at: number;
      tool: string;
      id?: string;
      ok: boolean;
      /** The tool was cancelled (for example the user pressed Esc). Not a failure. */
      interrupted?: boolean;
      error?: string;
    }
  | { kind: "permission_request"; at: number; tool: string }
  | { kind: "turn_stop"; at: number }
  | { kind: "api_error"; at: number; errorType: string; detail?: string }
  | { kind: "session_end"; at: number };

export interface ErrorRecord {
  id: number;
  at: number;
  source: "tool" | "api";
  tool?: string;
  errorType?: string;
  detail?: string;
}

export interface SessionState {
  monitor: MonitorState;
  sessionActive: boolean;
  startedAt: number | null;
  lastEventAt: number | null;
  turnActive: boolean;
  turnStartedAt: number | null;
  turnFinishedAt: number | null;
  /** Tools reported as started but not yet finished. key -> tool name */
  running: Record<string, string>;
  /** Tool Claude is asking permission for, only when a request event was seen. */
  waitingFor: string | null;
  /** Count of tool actions reported as finished successfully, by tool name. */
  completed: Record<string, number>;
  errors: ErrorRecord[];
  activeError: ErrorRecord | null;
  lastToolStartAt: number | null;
  nextErrorId: number;
}
