//! End-to-end checks against a REAL `claude` CLI. Slow and uses the logged-in account,
//! so they are ignored by default. Run with:
//!   cargo test --test real_claude -- --ignored --test-threads=1 --nocapture

use sentiqx_lib::normalize::ActivityEvent;
use sentiqx_lib::{receiver, settings_hooks};
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Mutex, mpsc};
use std::time::{Duration, Instant};

struct Scratch(PathBuf);

impl Scratch {
    fn new(name: &str) -> Self {
        let dir = std::env::temp_dir().join(format!("sentiqx-e2e-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        Scratch(std::fs::canonicalize(&dir).unwrap())
    }
    fn project(&self) -> String {
        self.0.to_string_lossy().trim_start_matches(r"\\?\").to_string()
    }
}

impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn run_claude(dir: &Scratch, prompt: &str, tools: &str) -> (bool, String, Duration) {
    let start = Instant::now();
    let out = Command::new("claude")
        .current_dir(&dir.0)
        .args(["-p", prompt, "--model", "haiku", "--allowedTools", tools, "--max-turns", "5"])
        .output()
        .expect("could not run `claude`");
    (
        out.status.success(),
        String::from_utf8_lossy(&out.stdout).trim().to_string(),
        start.elapsed(),
    )
}

fn collect(rx: &mpsc::Receiver<ActivityEvent>) -> Vec<ActivityEvent> {
    std::thread::sleep(Duration::from_millis(800));
    rx.try_iter().collect()
}

fn start_receiver(port: u16, token: &str) -> (receiver::Receiver, mpsc::Receiver<ActivityEvent>) {
    let (tx, rx) = mpsc::channel();
    let tx = Mutex::new(tx);
    let r = receiver::start(port, token.into(), move |e| {
        let _ = tx.lock().unwrap().send(e);
    })
    .unwrap();
    (r, rx)
}

#[test]
#[ignore]
fn real_session_events_arrive_in_order() {
    let dir = Scratch::new("live");
    let (r, rx) = start_receiver(47934, "e2e-token");
    r.set_scope(receiver::Scope::Project(dir.project()));
    r.set_active(true);
    settings_hooks::install(&dir.0, &settings_hooks::hook_url(47934), "e2e-token").unwrap();

    let (ok, out, took) = run_claude(&dir, "Create a file named hello.txt containing the word hello using the Write tool, then reply with the single word done.", "Write");
    let events = collect(&rx);
    let kinds: Vec<_> = events.iter().map(|e| e.kind).collect();
    println!("claude ok={ok} took={took:?} reply={out:?}\nevents={kinds:?}");

    assert!(ok, "claude should succeed with SENTIQX hooks installed");
    for expected in ["prompt", "tool_start", "tool_end", "turn_stop", "session_end"] {
        assert!(kinds.contains(&expected), "missing {expected} in {kinds:?}");
    }
    let pos = |k: &str| kinds.iter().position(|x| *x == k).unwrap();
    assert!(pos("prompt") < pos("tool_start") && pos("tool_start") < pos("tool_end") && pos("tool_end") < pos("turn_stop"));
    let end = events.iter().find(|e| e.kind == "tool_end").unwrap();
    assert_eq!((end.tool.as_deref(), end.ok), (Some("Write"), Some(true)));
    assert!(dir.0.join("hello.txt").exists(), "the file Claude reported creating must exist");
    println!("session ids: {:?}", events.iter().map(|e| e.session_id.clone()).collect::<std::collections::BTreeSet<_>>());
}

#[test]
#[ignore]
fn real_tool_failure_is_reported_as_failed() {
    let dir = Scratch::new("fail");
    let (r, rx) = start_receiver(47935, "e2e-token");
    r.set_scope(receiver::Scope::Project(dir.project()));
    r.set_active(true);
    settings_hooks::install(&dir.0, &settings_hooks::hook_url(47935), "e2e-token").unwrap();

    let (ok, _, _) = run_claude(&dir, r"Run this exact command once: dir C:\sentiqx-no-such-folder-xyz . Do not retry. Reply in one line.", "PowerShell,Bash");
    let events = collect(&rx);
    println!("events={:?}", events.iter().map(|e| (e.kind, e.tool.clone(), e.ok)).collect::<Vec<_>>());
    assert!(ok);
    let failed = events.iter().find(|e| e.kind == "tool_end" && e.ok == Some(false));
    assert!(failed.is_some(), "expected a failed tool_end, got {events:?}");
}

#[test]
#[ignore]
fn claude_still_works_when_sentiqx_is_not_running() {
    let dir = Scratch::new("dead");
    // Hooks point at a port nobody listens on.
    settings_hooks::install(&dir.0, &settings_hooks::hook_url(47936), "e2e-token").unwrap();
    let (ok, out, took) = run_claude(&dir, "Reply with just the word OK. Do not use tools.", "Write");
    println!("ok={ok} took={took:?} reply={out:?}");
    assert!(ok && out.contains("OK"), "claude must keep working without SENTIQX");
    assert!(took < Duration::from_secs(60), "hooks must not make Claude hang");
}

#[test]
#[ignore]
fn claude_still_works_when_the_token_is_wrong() {
    let dir = Scratch::new("badtoken");
    let (r, rx) = start_receiver(47937, "right-token");
    r.set_scope(receiver::Scope::Project(dir.project()));
    r.set_active(true);
    settings_hooks::install(&dir.0, &settings_hooks::hook_url(47937), "wrong-token").unwrap();
    let (ok, out, _) = run_claude(&dir, "Reply with just the word OK. Do not use tools.", "Write");
    assert!(ok && out.contains("OK"), "a 401 from SENTIQX must not break Claude");
    assert!(collect(&rx).is_empty(), "events with a wrong token must be dropped");
}

/// The app's no-folder path, without touching the real ~/.claude/settings.json: hooks are
/// written with `install_file` to a temporary settings file and given to Claude with
/// `--settings`. Whether Claude loads the real user-level file is checked by using the app.
#[test]
#[ignore]
fn no_folder_scope_receives_events_and_the_settings_file_is_restored_exactly() {
    let dir = Scratch::new("no-folder");
    let holder = Scratch::new("settings-holder");
    let file = holder.0.join("settings.json");
    let original = "{\n  \"theme\":   \"dark\"\n}\n"; // odd spacing on purpose
    std::fs::write(&file, original).unwrap();

    let (r, rx) = start_receiver(47939, "e2e-token");
    r.set_scope(receiver::Scope::All);
    r.set_active(true);
    let url = settings_hooks::hook_url(47939);
    settings_hooks::install_file(&file, &url, "e2e-token").unwrap();

    let out = Command::new("claude")
        .current_dir(&dir.0)
        .args(["-p", "Reply with just the word OK. Do not use tools.", "--model", "haiku", "--max-turns", "3"])
        .arg("--settings")
        .arg(&file)
        .output()
        .expect("could not run `claude`");
    let reply = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let name = dir.0.file_name().unwrap().to_string_lossy().to_string();
    let events: Vec<_> = collect(&rx).into_iter().filter(|e| e.project.as_deref() == Some(name.as_str())).collect();
    let kinds: Vec<_> = events.iter().map(|e| e.kind).collect();
    println!("reply={reply:?} events={kinds:?}");

    settings_hooks::uninstall_file(&file, &url).unwrap();
    assert_eq!(std::fs::read_to_string(&file).unwrap(), original, "must be restored byte for byte");
    assert!(!file.with_extension("json.sentiqx-backup").exists());

    assert!(out.status.success() && reply.contains("OK"));
    assert!(kinds.contains(&"prompt") && kinds.contains(&"turn_stop"), "events must arrive with no folder chosen: {kinds:?}");
}
