import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ActivityEvent } from "./types";

export interface ConnectorStatus {
  listening: boolean;
  port: number;
  error: string | null;
  settingsFile: string | null;
}

const KINDS = new Set([
  "session_start",
  "prompt",
  "tool_start",
  "tool_end",
  "permission_request",
  "turn_stop",
  "api_error",
  "session_end",
]);

/** Accepts only events with the shape the engine expects; everything else is dropped. */
export function toActivityEvent(raw: unknown): ActivityEvent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.kind !== "string" || !KINDS.has(e.kind) || typeof e.at !== "number") return null;
  if (
    (e.kind === "tool_start" || e.kind === "tool_end" || e.kind === "permission_request") &&
    typeof e.tool !== "string"
  ) {
    return null;
  }
  if (e.kind === "tool_end" && typeof e.ok !== "boolean") return null;
  if (e.kind === "api_error" && typeof e.errorType !== "string") return null;
  return e as unknown as ActivityEvent;
}

export const connectorStatus = () => invoke<ConnectorStatus>("connector_status");
export const startMonitoring = () => invoke<void>("start_monitoring");
export const setPaused = (paused: boolean) => invoke<void>("set_paused", { paused });
export const stopMonitoring = () => invoke<void>("stop_monitoring");
/** Optional: limit monitoring to one folder. `null` means every Claude session. */
export const setProjectFilter = (folder: string | null) => invoke<void>("set_project_filter", { folder });

/** Subscribes to events from the Rust receiver. Returns an unsubscribe function. */
export function onActivity(cb: (e: ActivityEvent) => void): () => void {
  let stop: (() => void) | null = null;
  let cancelled = false;
  listen<unknown>("activity", (msg) => {
    const ev = toActivityEvent(msg.payload);
    if (ev) cb(ev);
  })
    .then((un) => {
      if (cancelled) un();
      else stop = un;
    })
    .catch(() => {
      /* not running inside Tauri (plain browser): no live events */
    });
  return () => {
    cancelled = true;
    stop?.();
  };
}
