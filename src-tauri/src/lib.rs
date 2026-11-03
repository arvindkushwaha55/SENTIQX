pub mod normalize;
pub mod receiver;
pub mod settings_hooks;

use receiver::Receiver;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, Manager, RunEvent};

/// Fixed so the hook URL written into a project's settings stays valid across restarts.
pub const PORT: u16 = 47821;
const RECORD_FILE: &str = "active-project.txt";

struct Connector {
    token: String,
    receiver: Option<Receiver>,
    listen_error: Option<String>,
    /// Project whose settings currently contain our hooks.
    project: Mutex<Option<PathBuf>>,
    data_dir: PathBuf,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConnectorStatus {
    listening: bool,
    port: u16,
    error: Option<String>,
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

    /// Removes our hooks from the project (if any) and forgets it.
    fn release_project(&self) -> Result<(), String> {
        if let Some(r) = &self.receiver {
            r.set_active(false);
            r.set_project(None);
        }
        let taken = self.project.lock().map_err(|_| "internal lock error")?.take();
        let result = match taken {
            Some(p) => settings_hooks::uninstall(&p, &settings_hooks::hook_url(PORT)),
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
    }
}

/// Installs the hooks into `project` and starts passing that project's events on.
#[tauri::command]
fn start_monitoring(project: String, state: tauri::State<Connector>) -> Result<(), String> {
    let receiver = state
        .receiver
        .as_ref()
        .ok_or_else(|| state.listen_error.clone().unwrap_or_else(|| "receiver is not running".into()))?;
    let dir = PathBuf::from(&project);
    if !dir.is_dir() {
        return Err(format!("{project} is not a folder"));
    }

    state.release_project()?;
    settings_hooks::install(&dir, &settings_hooks::hook_url(PORT), &state.token)?;
    // Remember it so a crash cannot leave hooks behind forever.
    fs::create_dir_all(&state.data_dir).map_err(|e| e.to_string())?;
    fs::write(state.record_path(), &project).map_err(|e| e.to_string())?;

    *state.project.lock().map_err(|_| "internal lock error")? = Some(dir);
    receiver.set_project(Some(project));
    receiver.set_active(true);
    Ok(())
}

#[tauri::command]
fn set_paused(paused: bool, state: tauri::State<Connector>) {
    if let Some(r) = &state.receiver {
        let has_project = state.project.lock().map(|p| p.is_some()).unwrap_or(false);
        r.set_active(!paused && has_project);
    }
}

#[tauri::command]
fn stop_monitoring(state: tauri::State<Connector>) -> Result<(), String> {
    state.release_project()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let token = random_token()?;

            let handle = app.handle().clone();
            let (receiver, listen_error) = match receiver::start(PORT, token.clone(), move |event| {
                let _ = handle.emit("activity", event);
            }) {
                Ok(r) => (Some(r), None),
                Err(e) => (None, Some(e)),
            };

            let connector = Connector {
                token,
                receiver,
                listen_error,
                project: Mutex::new(None),
                data_dir,
            };

            // If the app crashed last time, take our hooks out of that project now.
            if let Ok(old) = fs::read_to_string(connector.record_path()) {
                let _ = settings_hooks::uninstall(&PathBuf::from(old.trim()), &settings_hooks::hook_url(PORT));
                let _ = fs::remove_file(connector.record_path());
            }

            app.manage(connector);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            connector_status,
            start_monitoring,
            set_paused,
            stop_monitoring
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|handle, event| {
        if let RunEvent::Exit = event
            && let Some(c) = handle.try_state::<Connector>()
        {
            let _ = c.release_project();
        }
    });
}
