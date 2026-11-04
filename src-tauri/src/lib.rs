pub mod active_window;
pub mod history;
pub mod lifecycle;
pub mod normalize;
pub mod privacy;
pub mod receiver;
pub mod settings_hooks;
pub mod window;

use active_window::{ActiveApp, Awareness};
use privacy::AwarenessPrefs;
use receiver::{Receiver, Scope};
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, RunEvent, WindowEvent};
use tauri_plugin_window_state::StateFlags;
use window::WindowPrefs;

/// Fixed so the hook URL written into the settings file stays valid across restarts.
pub const PORT: u16 = 47821;
const RECORD_FILE: &str = "active-hooks.txt";

struct Connector {
    token: String,
    receiver: Option<Receiver>,
    listen_error: Option<String>,
    /// The settings file that currently contains our hooks.
    installed: Mutex<Option<PathBuf>>,
    data_dir: PathBuf,
    home_dir: Option<PathBuf>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConnectorStatus {
    listening: bool,
    port: u16,
    error: Option<String>,
    /// The file hooks are written to when monitoring starts.
    settings_file: Option<String>,
}

fn random_token() -> Result<String, String> {
    let mut buf = [0u8; 24];
    getrandom::fill(&mut buf).map_err(|e| format!("no secure randomness available ({e})"))?;
    Ok(buf.iter().map(|b| format!("{b:02x}")).collect())
}

impl Connector {
    fn record_path(&self) -> PathBuf {
        self.data_dir.join(RECORD_FILE)
    }

    fn user_settings(&self) -> Option<PathBuf> {
        self.home_dir.as_deref().map(settings_hooks::user_settings_path)
    }

    /// Removes our hooks from the settings file (if any) and stops passing events on.
    fn release_hooks(&self) -> Result<(), String> {
        if let Some(r) = &self.receiver {
            r.set_active(false);
            r.set_scope(Scope::All);
        }
        let taken = self.installed.lock().map_err(|_| "internal lock error")?.take();
        let result = match taken {
            Some(file) => settings_hooks::uninstall_file(&file, &settings_hooks::hook_url(PORT)),
            None => Ok(()),
        };
        let _ = fs::remove_file(self.record_path());
        result
    }
}

#[tauri::command]
fn connector_status(state: tauri::State<Connector>) -> ConnectorStatus {
    ConnectorStatus {
        listening: state.receiver.is_some(),
        port: PORT,
        error: state.listen_error.clone(),
        settings_file: state.user_settings().map(|p| p.display().to_string()),
    }
}

/// Starts listening to Claude Code on this computer. No folder is needed: the hooks go into
/// the user-level settings file, which Claude Code applies to every session.
#[tauri::command]
fn start_monitoring(state: tauri::State<Connector>) -> Result<(), String> {
    let receiver = state
        .receiver
        .as_ref()
        .ok_or_else(|| state.listen_error.clone().unwrap_or_else(|| "receiver is not running".into()))?;
    let file = state.user_settings().ok_or("could not find your home folder")?;

    state.release_hooks()?;
    settings_hooks::install_file(&file, &settings_hooks::hook_url(PORT), &state.token)?;
    // Remember it so a crash cannot leave hooks behind forever.
    fs::create_dir_all(&state.data_dir).map_err(|e| e.to_string())?;
    fs::write(state.record_path(), file.display().to_string()).map_err(|e| e.to_string())?;

    *state.installed.lock().map_err(|_| "internal lock error")? = Some(file);
    receiver.set_scope(Scope::All);
    receiver.set_active(true);
    Ok(())
}

#[tauri::command]
fn set_paused(paused: bool, state: tauri::State<Connector>) {
    if let Some(r) = &state.receiver {
        let installed = state.installed.lock().map(|p| p.is_some()).unwrap_or(false);
        r.set_active(!paused && installed);
    }
}

#[tauri::command]
fn stop_monitoring(state: tauri::State<Connector>) -> Result<(), String> {
    state.release_hooks()
}

/// Optional: only listen to Claude sessions working inside this folder. `None` = all sessions.
#[tauri::command]
fn set_project_filter(folder: Option<String>, state: tauri::State<Connector>) -> Result<(), String> {
    let receiver = state.receiver.as_ref().ok_or("receiver is not running")?;
    match folder.map(|f| f.trim().to_string()).filter(|f| !f.is_empty()) {
        None => receiver.set_scope(Scope::All),
        Some(f) => {
            if !PathBuf::from(&f).is_dir() {
                return Err(format!("{f} is not a folder"));
            }
            receiver.set_scope(Scope::Project(f));
        }
    }
    Ok(())
}

// ---- active-application awareness (permission-gated) ----

struct Privacy {
    prefs: Mutex<AwarenessPrefs>,
    dir: PathBuf,
    awareness: Arc<Awareness>,
}

#[tauri::command]
fn awareness_prefs(state: tauri::State<Privacy>) -> AwarenessPrefs {
    state.prefs.lock().map(|p| *p).unwrap_or_default()
}

#[tauri::command]
fn set_awareness(enabled: bool, show_titles: bool, state: tauri::State<Privacy>) -> Result<(), String> {
    // Titles can only be on while awareness itself is on.
    let prefs = AwarenessPrefs { asked: true, enabled, show_titles: enabled && show_titles };
    privacy::save(&state.dir, &prefs)?;
    state.awareness.show_titles.store(prefs.show_titles, Ordering::SeqCst);
    state.awareness.enabled.store(prefs.enabled, Ordering::SeqCst);
    *state.prefs.lock().map_err(|_| "internal lock error")? = prefs;
    Ok(())
}

#[tauri::command]
fn active_app(state: tauri::State<Privacy>) -> Option<ActiveApp> {
    state.awareness.latest.lock().ok().and_then(|l| l.clone())
}

// ---- session history (optional: the app keeps working if the database cannot open) ----

struct HistoryState(Option<Arc<history::History>>);

impl HistoryState {
    fn get(&self) -> Result<&history::History, String> {
        self.0.as_deref().ok_or_else(|| "history is unavailable".to_string())
    }
}

#[tauri::command]
fn history_list(state: tauri::State<HistoryState>) -> Result<Vec<history::SessionRow>, String> {
    state.get()?.list(100)
}

#[tauri::command]
fn history_delete(id: String, state: tauri::State<HistoryState>) -> Result<(), String> {
    state.get()?.delete(&id)
}

#[tauri::command]
fn history_clear(state: tauri::State<HistoryState>) -> Result<(), String> {
    state.get()?.clear()
}

fn note(app: &tauri::AppHandle, event: &str) {
    if let Ok(dir) = app.path().app_data_dir() {
        lifecycle::log(&dir, receiver::now_ms(), event);
    }
}

/// The UI reports its own close button, so a click can be told apart from an outside close.
#[tauri::command]
fn note_close(source: String, app: tauri::AppHandle) {
    if let Some(event) = lifecycle::known_close_source(&source) {
        note(&app, event);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        // Remember position and size only. Visibility is handled by us, so a saved
        // "hidden" state can never leave the user without a window.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::POSITION | StateFlags::SIZE)
                .build(),
        )
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                note(window.app_handle(), "close requested (button, Alt+F4, taskbar or another program)");
            }
            // Losing focus must never drop the pin.
            if let WindowEvent::Focused(false) = event
                && window.label() == window::MAIN
                && let Some(prefs) = window.try_state::<WindowPrefs>()
            {
                window::reassert_pin(window, &prefs);
            }
        })
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let token = random_token()?;
            note(app.handle(), "start");

            // Window: apply the saved pin natively, build the tray, then show without stealing focus.
            let prefs = WindowPrefs::load(data_dir.clone());
            if let Some(main) = app.get_webview_window(window::MAIN) {
                window::apply_pin(&main, &prefs);
                let _ = main.show();
            }
            app.manage(prefs);
            window::build_tray(app.handle())?;

            // Application awareness: off until the user has allowed it.
            let saved = privacy::load(&data_dir);
            let awareness = Arc::new(Awareness::new(saved.enabled, saved.enabled && saved.show_titles));
            let emitter = app.handle().clone();
            let _ = active_window::spawn_watcher(awareness.clone(), std::process::id(), move |a| {
                let _ = emitter.emit("active-app", a);
            });
            app.manage(Privacy { prefs: Mutex::new(saved), dir: data_dir.clone(), awareness });

            // History is optional: if it cannot open, monitoring still works.
            let store = history::History::open(&data_dir.join("history.db")).ok().map(Arc::new);
            app.manage(HistoryState(store.clone()));

            // Claude Code connector.
            let handle = app.handle().clone();
            let (receiver, listen_error) = match receiver::start(PORT, token.clone(), move |event| {
                if let Some(h) = &store {
                    let _ = h.record(&event);
                }
                let _ = handle.emit("activity", event);
            }) {
                Ok(r) => (Some(r), None),
                Err(e) => (None, Some(e)),
            };

            let connector = Connector {
                token,
                receiver,
                listen_error,
                installed: Mutex::new(None),
                data_dir,
                home_dir: app.path().home_dir().ok(),
            };

            // If the app crashed last time, take our hooks out of that file now.
            if let Ok(old) = fs::read_to_string(connector.record_path()) {
                let old = PathBuf::from(old.trim());
                let url = settings_hooks::hook_url(PORT);
                // Older builds recorded a project folder, newer ones the settings file itself.
                let _ = if old.is_dir() {
                    settings_hooks::uninstall(&old, &url)
                } else {
                    settings_hooks::uninstall_file(&old, &url)
                };
                let _ = fs::remove_file(connector.record_path());
            }

            app.manage(connector);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            connector_status,
            start_monitoring,
            set_paused,
            stop_monitoring,
            set_project_filter,
            awareness_prefs,
            set_awareness,
            active_app,
            history_list,
            history_delete,
            history_clear,
            note_close,
            window::window_pinned,
            window::set_window_pinned
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            note(handle, "exit");
            if let Some(c) = handle.try_state::<Connector>() {
                let _ = c.release_hooks();
            }
        }
    });
}
