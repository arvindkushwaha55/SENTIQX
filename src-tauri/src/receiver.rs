//! Local-only HTTP receiver for Claude Code hook events.
//!
//! - Binds to 127.0.0.1 only, never a public interface.
//! - Requires the per-run secret token, so other local programs cannot inject events.
//! - Answers immediately: HTTP hooks block Claude until they get a reply.
//! - Drops events unless monitoring is active AND the event comes from the chosen project.

use crate::normalize::{ActivityEvent, normalize, path_within};
use std::io::Read;
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tiny_http::{Header, Method, Response, Server, StatusCode};

const MAX_BODY_BYTES: u64 = 256 * 1024;
const TOKEN_HEADER: &str = "x-sentiqx-token";

struct Shared {
    token: String,
    active: AtomicBool,
    project: Mutex<Option<String>>,
}

#[derive(Clone)]
pub struct Receiver {
    pub port: u16,
    shared: Arc<Shared>,
}

impl Receiver {
    pub fn set_active(&self, active: bool) {
        self.shared.active.store(active, Ordering::SeqCst);
    }

    pub fn set_project(&self, project: Option<String>) {
        if let Ok(mut p) = self.shared.project.lock() {
            *p = project;
        }
    }
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn tokens_match(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.bytes().zip(b.bytes()).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

fn json_response(status: u16, body: &str) -> Response<std::io::Cursor<Vec<u8>>> {
    let mut r = Response::from_string(body).with_status_code(StatusCode(status));
    if let Ok(h) = Header::from_bytes("Content-Type", "application/json") {
        r.add_header(h);
    }
    r
}

/// Starts the receiver on `port`. `on_event` is called for every accepted event.
pub fn start(
    port: u16,
    token: String,
    on_event: impl Fn(ActivityEvent) + Send + Sync + 'static,
) -> Result<Receiver, String> {
    let server = Server::http(("127.0.0.1", port))
        .map_err(|e| format!("could not listen on 127.0.0.1:{port} ({e})"))?;
    let shared = Arc::new(Shared {
        token,
        active: AtomicBool::new(false),
        project: Mutex::new(None),
    });
    let worker = shared.clone();

    std::thread::Builder::new()
        .name("sentiqx-receiver".into())
        .spawn(move || {
            for request in server.incoming_requests() {
                // One bad request must never take the receiver down.
                let _ = catch_unwind(AssertUnwindSafe(|| handle(request, &worker, &on_event)));
            }
        })
        .map_err(|e| format!("could not start the receiver thread ({e})"))?;

    Ok(Receiver { port, shared })
}

fn handle(mut request: tiny_http::Request, shared: &Shared, on_event: &impl Fn(ActivityEvent)) {
    if request.method() != &Method::Post || request.url() != "/event" {
        let _ = request.respond(json_response(404, "{}"));
        return;
    }

    let authorised = request
        .headers()
        .iter()
        .find(|h| h.field.as_str().as_str().eq_ignore_ascii_case(TOKEN_HEADER))
        .is_some_and(|h| tokens_match(h.value.as_str(), &shared.token));
    if !authorised {
        let _ = request.respond(json_response(401, "{}"));
        return;
    }

    if request.body_length().is_some_and(|n| n as u64 > MAX_BODY_BYTES) {
        let _ = request.respond(json_response(413, "{}"));
        return;
    }
    let mut body = Vec::new();
    let read_ok = request
        .as_reader()
        .take(MAX_BODY_BYTES + 1)
        .read_to_end(&mut body)
        .is_ok();
    if !read_ok || body.len() as u64 > MAX_BODY_BYTES {
        let _ = request.respond(json_response(413, "{}"));
        return;
    }

    // Reply first so Claude is never kept waiting on our processing.
    let _ = request.respond(json_response(200, "{}"));

    if !shared.active.load(Ordering::SeqCst) {
        return;
    }
    let Ok(payload) = serde_json::from_slice::<serde_json::Value>(&body) else { return };
    let project = shared.project.lock().ok().and_then(|p| p.clone());
    let cwd = payload.get("cwd").and_then(|c| c.as_str()).unwrap_or("");
    match project {
        Some(p) if path_within(&p, cwd) => {}
        _ => return,
    }
    if let Some(event) = normalize(&payload, now_ms()) {
        on_event(event);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpStream;
    use std::sync::mpsc;
    use std::time::Duration;

    fn post(port: u16, path: &str, token: Option<&str>, body: &str) -> String {
        let mut s = TcpStream::connect(("127.0.0.1", port)).unwrap();
        s.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
        let auth = token.map(|t| format!("X-Sentiqx-Token: {t}\r\n")).unwrap_or_default();
        let req = format!(
            "POST {path} HTTP/1.1\r\nHost: x\r\n{auth}Content-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        s.write_all(req.as_bytes()).unwrap();
        let mut out = String::new();
        let _ = s.read_to_string(&mut out);
        out
    }

    fn setup(port: u16) -> (Receiver, mpsc::Receiver<ActivityEvent>) {
        let (tx, rx) = mpsc::channel();
        let tx = Mutex::new(tx);
        let r = start(port, "secret".into(), move |e| {
            let _ = tx.lock().unwrap().send(e);
        })
        .unwrap();
        (r, rx)
    }

    #[test]
    fn rejects_missing_or_wrong_token_and_wrong_path() {
        let (r, rx) = setup(47931);
        r.set_active(true);
        r.set_project(Some(r"C:\proj".into()));
        let body = r#"{"hook_event_name":"Stop","cwd":"C:\\proj"}"#;
        assert!(post(47931, "/event", None, body).starts_with("HTTP/1.1 401"));
        assert!(post(47931, "/event", Some("nope"), body).starts_with("HTTP/1.1 401"));
        assert!(post(47931, "/other", Some("secret"), body).starts_with("HTTP/1.1 404"));
        assert!(rx.recv_timeout(Duration::from_millis(300)).is_err());
    }

    #[test]
    fn accepts_events_only_when_active_and_from_the_chosen_project() {
        let (r, rx) = setup(47932);
        let mine = r#"{"hook_event_name":"Stop","session_id":"s","cwd":"C:\\proj\\src"}"#;
        let other = r#"{"hook_event_name":"Stop","session_id":"s","cwd":"C:\\elsewhere"}"#;

        // Not active yet: replied OK, but nothing is passed on.
        assert!(post(47932, "/event", Some("secret"), mine).starts_with("HTTP/1.1 200"));
        assert!(rx.recv_timeout(Duration::from_millis(300)).is_err());

        r.set_active(true);
        r.set_project(Some(r"C:\proj".into()));
        post(47932, "/event", Some("secret"), other);
        assert!(rx.recv_timeout(Duration::from_millis(300)).is_err());

        post(47932, "/event", Some("secret"), mine);
        let e = rx.recv_timeout(Duration::from_secs(2)).unwrap();
        assert_eq!(e.kind, "turn_stop");

        // Paused again: dropped.
        r.set_active(false);
        post(47932, "/event", Some("secret"), mine);
        assert!(rx.recv_timeout(Duration::from_millis(300)).is_err());
    }

    #[test]
    fn survives_garbage_and_oversized_bodies() {
        let (r, rx) = setup(47933);
        r.set_active(true);
        r.set_project(Some(r"C:\proj".into()));
        assert!(post(47933, "/event", Some("secret"), "not json").starts_with("HTTP/1.1 200"));
        let big = "x".repeat(300 * 1024);
        assert!(post(47933, "/event", Some("secret"), &big).starts_with("HTTP/1.1 413"));
        // Still alive afterwards.
        let ok = r#"{"hook_event_name":"UserPromptSubmit","cwd":"C:\\proj"}"#;
        post(47933, "/event", Some("secret"), ok);
        assert_eq!(rx.recv_timeout(Duration::from_secs(2)).unwrap().kind, "prompt");
    }

    #[test]
    fn token_compare_is_exact() {
        assert!(tokens_match("abc", "abc"));
        assert!(!tokens_match("abc", "abd"));
        assert!(!tokens_match("abc", "abcd"));
    }
}
