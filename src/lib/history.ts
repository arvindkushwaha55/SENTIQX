import { invoke } from "@tauri-apps/api/core";

export interface ToolCount {
  tool: string;
  ok: number;
  failed: number;
}

export interface SessionRow {
  id: string;
  project: string | null;
  startedAt: number;
  lastAt: number;
  lastKind: string;
  tools: ToolCount[];
  apiErrors: string[];
}

export const historyList = () => invoke<SessionRow[]>("history_list");
export const historyDelete = (id: string) => invoke<void>("history_delete", { id });
export const historyClear = () => invoke<void>("history_clear");

export type Outcome = "finished" | "error" | "ended" | "unknown";

/** Says only what was reported: a session with no final event stays "unknown", never "done". */
export function outcomeOf(row: Pick<SessionRow, "lastKind">): Outcome {
  switch (row.lastKind) {
    case "turn_stop":
      return "finished";
    case "api_error":
      return "error";
    case "session_end":
      return "ended";
    default:
      return "unknown";
  }
}
