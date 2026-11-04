import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";

/**
 * Pin state lives in Rust (real topmost window flag, saved on disk). The UI only
 * asks for changes and shows the result. If the call fails, the UI does not pretend.
 */
export function usePinned(): { pinned: boolean; toggle: () => void; failed: boolean } {
  const [pinned, setPinned] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    invoke<boolean>("window_pinned")
      .then(setPinned)
      .catch(() => setFailed(true));
  }, []);

  const toggle = useCallback(() => {
    const next = !pinned;
    invoke<void>("set_window_pinned", { pinned: next })
      .then(() => {
        setPinned(next);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [pinned]);

  return { pinned, toggle, failed };
}

const run = (f: () => Promise<void>) => void f().catch(() => undefined);

/** Hide keeps the app and monitoring running; the tray icon brings the window back. */
export const hideWindow = () => run(() => getCurrentWindow().hide());
export const closeWindow = (trusted: boolean) =>
  run(async () => {
    await invoke<void>("note_close", { source: trusted ? "title-bar-button" : "title-bar-button-untrusted" }).catch(() => undefined);
    await getCurrentWindow().close();
  });
