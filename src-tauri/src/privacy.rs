//! Saved privacy choices. The active-application awareness is OFF until the user allows it,
//! and window titles stay off until the user separately allows those too.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

const FILE: &str = "awareness.json";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct AwarenessPrefs {
    /// The user has answered the permission question at least once.
    pub asked: bool,
    pub enabled: bool,
    pub show_titles: bool,
}

pub fn parse(text: &str) -> AwarenessPrefs {
    serde_json::from_str(text).unwrap_or_default()
}

pub fn load(dir: &Path) -> AwarenessPrefs {
    fs::read_to_string(dir.join(FILE)).map(|t| parse(&t)).unwrap_or_default()
}

pub fn save(dir: &Path, prefs: &AwarenessPrefs) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let text = serde_json::to_string(prefs).map_err(|e| e.to_string())?;
    fs::write(dir.join(FILE), text).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nothing_is_allowed_by_default() {
        let p = parse("");
        assert_eq!(p, AwarenessPrefs { asked: false, enabled: false, show_titles: false });
        assert_eq!(parse("not json"), p);
        assert_eq!(parse("{}"), p);
    }

    #[test]
    fn a_partial_file_never_turns_on_more_than_it_says() {
        let p = parse(r#"{"asked":true,"enabled":true}"#);
        assert!(p.asked && p.enabled && !p.show_titles);
    }

    #[test]
    fn choices_survive_a_restart() {
        let dir = std::env::temp_dir().join(format!("sentiqx-priv-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let want = AwarenessPrefs { asked: true, enabled: true, show_titles: true };
        save(&dir, &want).unwrap();
        assert_eq!(load(&dir), want);
        let _ = fs::remove_dir_all(&dir);
    }
}
