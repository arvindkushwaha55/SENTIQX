//! Adds and removes SENTIQX's hooks in a project's `.claude/settings.local.json`.
//!
//! Only entries whose URL is exactly SENTIQX's are ever added or removed. Everything
//! else in the file (other hooks, permissions, unknown keys) is left as it was, and a
//! file that is not valid JSON is never touched.

use serde_json::{Map, Value, json};
use std::fs;
use std::path::{Path, PathBuf};

/// `SessionStart` is deliberately absent: Claude Code documents that it does not support
/// HTTP hooks (command and MCP-tool only). A session is inferred from the first event.
pub const EVENTS: [&str; 8] = [
    "UserPromptSubmit",
    "PreToolUse",
    "PermissionRequest",
    "PostToolUse",
    "PostToolUseFailure",
    "Stop",
    "StopFailure",
    "SessionEnd",
];

/// Seconds. HTTP hooks block Claude until they answer, so keep this short.
const HOOK_TIMEOUT_SECS: u64 = 2;
const TOKEN_HEADER: &str = "X-Sentiqx-Token";

pub fn hook_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}/event")
}

pub fn settings_path(project: &Path) -> PathBuf {
    project.join(".claude").join("settings.local.json")
}

/// Removes our entries. Returns true if anything changed.
pub fn remove_hooks(settings: &mut Value, url: &str) -> bool {
    let Some(hooks) = settings.get_mut("hooks").and_then(Value::as_object_mut) else {
        return false;
    };
    let mut changed = false;
    for groups in hooks.values_mut() {
        let Some(groups) = groups.as_array_mut() else { continue };
        for group in groups.iter_mut() {
            if let Some(handlers) = group.get_mut("hooks").and_then(Value::as_array_mut) {
                let before = handlers.len();
                handlers.retain(|h| h.get("url").and_then(Value::as_str) != Some(url));
                changed |= handlers.len() != before;
            }
        }
        let before = groups.len();
        groups.retain(|g| {
            g.get("hooks")
                .and_then(Value::as_array)
                .is_none_or(|h| !h.is_empty())
        });
        changed |= groups.len() != before;
    }
    let before = hooks.len();
    hooks.retain(|_, v| v.as_array().is_none_or(|a| !a.is_empty()));
    changed |= hooks.len() != before;
    if hooks.is_empty()
        && let Some(obj) = settings.as_object_mut()
    {
        obj.remove("hooks");
        changed = true;
    }
    changed
}

/// Adds our entries (replacing any older ones of ours). Errors if the file shape is unexpected.
pub fn add_hooks(settings: &mut Value, url: &str, token: &str) -> Result<(), String> {
    if !settings.is_object() {
        return Err("settings.local.json is not a JSON object".into());
    }
    remove_hooks(settings, url);
    let root = settings.as_object_mut().expect("checked above");
    let hooks = root
        .entry("hooks")
        .or_insert_with(|| Value::Object(Map::new()))
        .as_object_mut()
        .ok_or("the \"hooks\" entry in settings.local.json is not an object")?;
    for event in EVENTS {
        let groups = hooks
            .entry(event)
            .or_insert_with(|| Value::Array(Vec::new()))
            .as_array_mut()
            .ok_or_else(|| format!("hooks.{event} in settings.local.json is not a list"))?;
        groups.push(json!({
            "hooks": [{
                "type": "http",
                "url": url,
                "headers": { TOKEN_HEADER: token },
                "timeout": HOOK_TIMEOUT_SECS
            }]
        }));
    }
    Ok(())
}

fn read_settings(path: &Path) -> Result<Option<Value>, String> {
    match fs::read_to_string(path) {
        Ok(s) if s.trim().is_empty() => Ok(Some(json!({}))),
        Ok(s) => serde_json::from_str(&s)
            .map(Some)
            .map_err(|e| format!("{} is not valid JSON, so SENTIQX left it alone ({e})", path.display())),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("could not read {}: {e}", path.display())),
    }
}

fn write_atomic(path: &Path, value: &Value) -> Result<(), String> {
    let tmp = path.with_extension("json.sentiqx-tmp");
    let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(&tmp, text).map_err(|e| format!("could not write {}: {e}", tmp.display()))?;
    fs::rename(&tmp, path).map_err(|e| format!("could not replace {}: {e}", path.display()))
}

/// `<home>/.claude/settings.json`: the documented user-level settings file. Hooks here apply
/// to every Claude Code session on this computer, so no project has to be chosen.
pub fn user_settings_path(home: &Path) -> PathBuf {
    home.join(".claude").join("settings.json")
}

pub fn install(project: &Path, url: &str, token: &str) -> Result<(), String> {
    install_file(&settings_path(project), url, token)
}

pub fn uninstall(project: &Path, url: &str) -> Result<(), String> {
    uninstall_file(&settings_path(project), url)
}

pub fn install_file(path: &Path, url: &str, token: &str) -> Result<(), String> {
    let path = path.to_path_buf();
    let existing = read_settings(&path)?;
    let mut settings = match &existing {
        Some(v) => v.clone(),
        None => json!({}),
    };
    add_hooks(&mut settings, url, token)?;

    if existing.is_some() {
        let backup = path.with_extension("json.sentiqx-backup");
        if !backup.exists() {
            fs::copy(&path, &backup).map_err(|e| format!("could not back up {}: {e}", path.display()))?;
        }
    } else if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("could not create {}: {e}", dir.display()))?;
    }
    write_atomic(&path, &settings)
}

pub fn uninstall_file(path: &Path, url: &str) -> Result<(), String> {
    let path = path.to_path_buf();
    let Some(mut settings) = read_settings(&path)? else { return Ok(()) };
    if !remove_hooks(&mut settings, url) {
        return Ok(());
    }

    // Leave the file exactly as it was. If nothing else changed while we were connected, the
    // backup is put back byte for byte; if the user changed something, their change is kept.
    let backup = path.with_extension("json.sentiqx-backup");
    let unchanged = fs::read_to_string(&backup)
        .ok()
        .and_then(|t| serde_json::from_str::<Value>(&t).ok())
        .is_some_and(|b| b == settings);
    if unchanged {
        return fs::rename(&backup, &path).map_err(|e| format!("could not restore {}: {e}", path.display()));
    }
    let _ = fs::remove_file(&backup);

    if settings.as_object().is_some_and(Map::is_empty) {
        fs::remove_file(&path).map_err(|e| format!("could not remove {}: {e}", path.display()))
    } else {
        write_atomic(&path, &settings)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const URL: &str = "http://127.0.0.1:47821/event";

    #[test]
    fn adds_one_http_hook_per_event_with_token_and_short_timeout() {
        let mut s = json!({});
        add_hooks(&mut s, URL, "tok").unwrap();
        for ev in EVENTS {
            let h = &s["hooks"][ev][0]["hooks"][0];
            assert_eq!(h["type"], "http");
            assert_eq!(h["url"], URL);
            assert_eq!(h["headers"]["X-Sentiqx-Token"], "tok");
            assert_eq!(h["timeout"], 2);
        }
    }

    #[test]
    fn add_then_remove_restores_unrelated_settings_exactly() {
        let original = json!({
            "permissions": {"allow": ["Bash(git status)"]},
            "hooks": {"PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": "echo hi"}]}]},
            "custom": 1
        });
        let mut s = original.clone();
        add_hooks(&mut s, URL, "tok").unwrap();
        assert_ne!(s, original);
        assert!(remove_hooks(&mut s, URL));
        assert_eq!(s, original);
    }

    #[test]
    fn adding_twice_does_not_duplicate() {
        let mut s = json!({});
        add_hooks(&mut s, URL, "a").unwrap();
        add_hooks(&mut s, URL, "b").unwrap();
        assert_eq!(s["hooks"]["Stop"].as_array().unwrap().len(), 1);
        assert_eq!(s["hooks"]["Stop"][0]["hooks"][0]["headers"]["X-Sentiqx-Token"], "b");
    }

    #[test]
    fn remove_on_a_file_without_our_hooks_changes_nothing() {
        let mut s = json!({"hooks": {"Stop": [{"hooks": [{"type": "command", "command": "x"}]}]}});
        let before = s.clone();
        assert!(!remove_hooks(&mut s, URL));
        assert_eq!(s, before);
    }

    #[test]
    fn rejects_unexpected_shapes_instead_of_overwriting() {
        assert!(add_hooks(&mut json!([]), URL, "t").is_err());
        assert!(add_hooks(&mut json!({"hooks": 5}), URL, "t").is_err());
        assert!(add_hooks(&mut json!({"hooks": {"Stop": "no"}}), URL, "t").is_err());
    }

    #[test]
    fn file_round_trip_keeps_a_backup_and_removes_an_empty_file() {
        let dir = std::env::temp_dir().join(format!("sentiqx-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join(".claude")).unwrap();
        let path = settings_path(&dir);
        fs::write(&path, r#"{"permissions":{"allow":["Read"]}}"#).unwrap();

        install(&dir, URL, "tok").unwrap();
        assert!(path.with_extension("json.sentiqx-backup").exists());
        assert!(fs::read_to_string(&path).unwrap().contains("X-Sentiqx-Token"));

        uninstall(&dir, URL).unwrap();
        // Byte for byte what the user had, and no backup left behind.
        assert_eq!(fs::read_to_string(&path).unwrap(), r#"{"permissions":{"allow":["Read"]}}"#);
        assert!(!path.with_extension("json.sentiqx-backup").exists());

        // If the user changed the file while connected, their change survives.
        install(&dir, URL, "tok").unwrap();
        let mut edited: Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        edited["theme"] = json!("dark");
        fs::write(&path, edited.to_string()).unwrap();
        uninstall(&dir, URL).unwrap();
        let after: Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(after, json!({"permissions":{"allow":["Read"]},"theme":"dark"}));
        assert!(!path.with_extension("json.sentiqx-backup").exists());

        // A file we created ourselves disappears again after uninstall.
        let fresh = std::env::temp_dir().join(format!("sentiqx-test-fresh-{}", std::process::id()));
        let _ = fs::remove_dir_all(&fresh);
        install(&fresh, URL, "tok").unwrap();
        assert!(settings_path(&fresh).exists());
        uninstall(&fresh, URL).unwrap();
        assert!(!settings_path(&fresh).exists());

        // Invalid JSON is never overwritten.
        fs::write(&path, "{ not json").unwrap();
        assert!(install(&dir, URL, "tok").is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "{ not json");

        let _ = fs::remove_dir_all(&dir);
        let _ = fs::remove_dir_all(&fresh);
    }
}
