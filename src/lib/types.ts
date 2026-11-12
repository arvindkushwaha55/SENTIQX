export type Status = "working" | "waiting" | "stuck" | "error" | "done";
export type MonitorState = "off" | "on" | "paused";
export type Language = "en" | "hinglish";
export type Theme = "dark" | "bright";
export type ToolKind = "edit" | "run" | "read" | "web" | "agent" | "other";

/**
 * Normalised activity events. The Claude Code connector (next stage) will
 * translate real hook events into these. Nothing outside this union can change
 * what SENTIQX shows, so the UI can never display activity that was not reported.
 */
export type ActivityEvent = { sessionId?: string; project?: string } & (
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
  | { kind: "session_end"; at: number }
);

/** One line of the "recent activity" list. Built only from reported events. */
export interface FeedItem {
  at: number;
  kind: "prompt" | "tool" | "wait" | "stop" | "error" | "end";
  tool?: string;
  ok?: boolean;
  interrupted?: boolean;
  errorType?: string;
}

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
  sessionId: string | null;
  /** Name of the working folder reported by the latest event. */
  project: string | null;
  startedAt: number | null;
  /** Most recent reported events, newest last. */
  feed: FeedItem[];
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
