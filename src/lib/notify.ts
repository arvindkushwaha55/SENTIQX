import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import type { Dict } from "./i18n";
import type { SessionState, Status } from "./types";

/** Short turns finish while you are watching, so they do not deserve a notification. */
export const DONE_NOTIFY_AFTER_MS = 30_000;

/**
 * Decides whether a status change is worth interrupting someone for. Only meaningful
 * changes qualify, and only on the change itself, so a status can never notify twice in a row.
 */
export function notificationFor(
  prev: Status | null,
  next: Status | null,
  s: SessionState,
  d: Dict,
): { title: string; body: string } | null {
  if (next === prev || next === null) return null;
  const n = d.notify;
  switch (next) {
    case "waiting":
      return { title: n.waitingTitle, body: d.line1.waiting(s.waitingFor ?? "?") };
    case "error":
      // One failed tool is routine: Claude usually moves on by itself. API errors stop the work.
      if (s.activeError?.source !== "api") return null;
      return { title: n.errorTitle, body: (d.error.api[s.activeError.errorType ?? ""] ?? d.error.apiUnknown).what };
    case "stuck":
      return { title: n.stuckTitle, body: n.stuckBody };
    case "done": {
      if (s.turnStartedAt === null || s.turnFinishedAt === null) return null;
      if (s.turnFinishedAt - s.turnStartedAt < DONE_NOTIFY_AFTER_MS) return null;
      return { title: n.doneTitle, body: d.line1.done };
    }
    default:
      return null;
  }
}

export async function notify(title: string, body: string): Promise<void> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === "granted";
    if (granted) sendNotification({ title, body });
  } catch {
    /* notifications are optional: failing here must never affect monitoring */
  }
}
