//! A tiny local log of why the app started and closed, so "the window disappeared" can be
//! answered with facts. It holds only times and fixed event names, no personal data, and
//! is capped so it can never grow large.

use std::fs;
use std::io::Write;
use std::path::Path;

const FILE: &str = "lifecycle.log";
const MAX_BYTES: u64 = 64 * 1024;

pub fn log(dir: &Path, at_ms: u64, event: &str) {
    let _ = fs::create_dir_all(dir);
    let path = dir.join(FILE);
    if fs::metadata(&path).map(|m| m.len() > MAX_BYTES).unwrap_or(false) {
        let _ = fs::remove_file(&path);
    }
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "{at_ms} {event}");
    }
}

/// Close sources the UI may report. Anything else is ignored, so nothing free-form is stored.
pub fn known_close_source(source: &str) -> Option<&'static str> {
    match source {
        "title-bar-button" => Some("close: title bar button (trusted click)"),
        "title-bar-button-untrusted" => Some("close: title bar button (scripted click)"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_lines_and_stays_capped() {
        let dir = std::env::temp_dir().join(format!("sentiqx-life-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        log(&dir, 1, "start");
        assert_eq!(fs::read_to_string(dir.join(FILE)).unwrap(), "1 start\n");
        fs::write(dir.join(FILE), "x".repeat(MAX_BYTES as usize + 1)).unwrap();
        log(&dir, 2, "exit");
        assert_eq!(fs::read_to_string(dir.join(FILE)).unwrap(), "2 exit\n");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn only_known_sources_are_accepted() {
        assert!(known_close_source("title-bar-button").is_some());
        assert!(known_close_source("anything else").is_none());
    }
}
