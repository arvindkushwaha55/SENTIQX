import type { Dict } from "./i18n";

export function elapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function ago(ms: number, t: Dict["time"]): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 5) return t.justNow;
  if (sec < 60) return t.secondsAgo(sec);
  if (sec < 3600) return t.minutesAgo(Math.floor(sec / 60));
  return t.hoursAgo(Math.floor(sec / 3600));
}

export const shortId = (id: string | null) => (id ? id.slice(0, 6) : null);
