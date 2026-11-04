//! Native window behaviour: always-on-top, show/hide from the tray, and remembering the pin.
//!
//! Everything here uses real window APIs (Win32 topmost via Tauri). Nothing is simulated in CSS.

use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, WebviewWindow};

pub const MAIN: &str = "main";
const PREFS_FILE: &str = "window.json";

pub struct WindowPrefs {
    pinned: AtomicBool,
    path: PathBuf,
}

/// Pinned by default; any unreadable or missing file also means pinned.
pub fn parse_pinned(text: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(text)
        .ok()
        .and_then(|v| v.get("pinned").and_then(|p| p.as_bool()))
        .unwrap_or(true)
}

impl WindowPrefs {
    pub fn load(data_dir: PathBuf) -> Self {
        let path = data_dir.join(PREFS_FILE);
        let pinned = fs::read_to_string(&path).map(|t| parse_pinned(&t)).unwrap_or(true);
        Self { pinned: AtomicBool::new(pinned), path }
    }

    pub fn is_pinned(&self) -> bool {
        self.pinned.load(Ordering::SeqCst)
    }

    fn save(&self, pinned: bool) -> Result<(), String> {
        self.pinned.store(pinned, Ordering::SeqCst);
        if let Some(dir) = self.path.parent() {
            fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        fs::write(&self.path, serde_json::json!({ "pinned": pinned }).to_string()).map_err(|e| e.to_string())
    }
}

/// Applies the saved pin to the window, without taking keyboard focus.
pub fn apply_pin(window: &WebviewWindow, prefs: &WindowPrefs) {
    let _ = window.set_always_on_top(prefs.is_pinned());
}

/// Called when the window loses focus: re-assert topmost so nothing can quietly drop it.
pub fn reassert_pin(window: &tauri::Window, prefs: &WindowPrefs) {
    if prefs.is_pinned() {
        let _ = window.set_always_on_top(true);
    }
}

#[tauri::command]
pub fn window_pinned(prefs: tauri::State<WindowPrefs>) -> bool {
    prefs.is_pinned()
}

#[tauri::command]
pub fn set_window_pinned(
    pinned: bool,
    window: WebviewWindow,
    prefs: tauri::State<WindowPrefs>,
) -> Result<(), String> {
    window.set_always_on_top(pinned).map_err(|e| e.to_string())?;
    prefs.save(pinned)
}

/// Show the window if hidden or minimised, hide it if visible.
pub fn toggle_visibility(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN) else { return };
    let visible = window.is_visible().unwrap_or(false);
    let minimised = window.is_minimized().unwrap_or(false);
    if visible && !minimised {
        let _ = window.hide();
    } else {
        let _ = window.show();
        let _ = window.unminimize();
    }
}

pub fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "Show / Hide SENTIQX", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit SENTIQX", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&toggle, &quit])?;

    let mut tray = TrayIconBuilder::new()
        .tooltip("SENTIQX")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle" => toggle_visibility(app),
            "quit" => {
                if let Ok(dir) = app.path().app_data_dir() {
                    crate::lifecycle::log(&dir, crate::receiver::now_ms(), "close: tray menu Quit");
                }
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_visibility(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pinned_unless_the_user_turned_it_off() {
        assert!(parse_pinned(r#"{"pinned":true}"#));
        assert!(!parse_pinned(r#"{"pinned":false}"#));
        assert!(parse_pinned(""));
        assert!(parse_pinned("not json"));
        assert!(parse_pinned(r#"{"other":1}"#));
    }

    #[test]
    fn saved_choice_survives_a_reload() {
        let dir = std::env::temp_dir().join(format!("sentiqx-win-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let prefs = WindowPrefs::load(dir.clone());
        assert!(prefs.is_pinned());
        prefs.save(false).unwrap();
        assert!(!WindowPrefs::load(dir.clone()).is_pinned());
        let _ = fs::remove_dir_all(&dir);
    }
}
