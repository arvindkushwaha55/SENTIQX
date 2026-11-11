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

/// Which Claude Code sessions are listened to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Scope {
    /// Every session on this computer (user-level hooks). No folder has to be chosen.
    All,
    /// Only sessions whose working folder is inside this folder.
    Project(String),
}

struct Shared {
    token: String,
    active: AtomicBool,
    scope: Mutex<Scope>,
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

    pub fn set_scope(&self, scope: Scope) {
        if let Ok(mut s) = self.shared.scope.lock() {
            *s = scope;
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

/// Extra routes used by the editor extension. They need the same secret token.
pub trait EditorRoutes: Send + Sync {
    fn context(&self, body: &[u8]) -> bool;
    fn result(&self, body: &[u8]) -> bool;
    /// A fix the user approved, as JSON, handed over once.
    fn pending(&self) -> Option<String>;
}

/// Starts the receiver on `port`. `on_event` is called for every accepted event.
pub fn start(
    port: u16,
    token: String,
    on_event: impl Fn(ActivityEvent) + Send + Sync + 'static,
) -> Result<Receiver, String> {
    start_with_routes(port, token, on_event, None)
}

pub fn start_with_routes(
    port: u16,
    token: String,
    on_event: impl Fn(ActivityEvent) + Send + Sync + 'static,
    routes: Option<Arc<dyn EditorRoutes>>,
) -> Result<Receiver, String> {
    let server = Server::http(("127.0.0.1", port))
        .map_err(|e| format!("could not listen on 127.0.0.1:{port} ({e})"))?;
    let shared = Arc::new(Shared {
        token,
        active: AtomicBool::new(false),
        scope: Mutex::new(Scope::All),
    });
    let worker = shared.clone();

    std::thread::Builder::new()
        .name("sentiqx-receiver".into())
        .spawn(move || {
            for request in server.incoming_requests() {
                // One bad request must never take the receiver down.
                let _ = catch_unwind(AssertUnwindSafe(|| handle(request, &worker, &on_event, routes.as_deref())));
            }
        })
        .map_err(|e| format!("could not start the receiver thread ({e})"))?;

    Ok(Receiver { port, shared })
}

fn handle(
    mut request: tiny_http::Request,
    shared: &Shared,
    on_event: &impl Fn(ActivityEvent),
    routes: Option<&dyn EditorRoutes>,
) {
    let url = request.url().to_string();
    let is_post = request.method() == &Method::Post;
    let is_get = request.method() == &Method::Get;
    let known = (is_post && url == "/event")
        || (routes.is_some() && ((is_post && (url == "/editor/context" || url == "/editor/result")) || (is_get && url == "/editor/pending")));
    if !known {
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

    if is_get {
        // Only /editor/pending gets here.
        let pending = routes.and_then(|r| r.pending());
        let _ = match pending {
            Some(json) => request.respond(json_response(200, &json)),
            None => request.respond(json_response(204, "")),
        };
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

    if let Some(r) = routes.filter(|_| url != "/event") {
        let accepted = if url == "/editor/context" { r.context(&body) } else { r.result(&body) };
        let _ = request.respond(json_response(if accepted { 200 } else { 400 }, "{}"));
        return;
    }

    // Reply first so Claude is never kept waiting on our processing.
    let _ = request.respond(json_response(200, "{}"));

    if !shared.active.load(Ordering::SeqCst) {
        return;
    }
    let Ok(payload) = serde_json::from_slice::<serde_json::Value>(&body) else { return };
    let Some(scope) = shared.scope.lock().ok().map(|s| s.clone()) else { return };
    let cwd = payload.get("cwd").and_then(|c| c.as_str()).unwrap_or("");
    match scope {
        Scope::All => {}
        Scope::Project(p) if path_within(&p, cwd) => {}
        Scope::Project(_) => return,
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
        r.set_scope(Scope::Project(r"C:\proj".into()));
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
        r.set_scope(Scope::Project(r"C:\proj".into()));
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
        r.set_scope(Scope::All);
        assert!(post(47933, "/event", Some("secret"), "not json").starts_with("HTTP/1.1 200"));
        let big = "x".repeat(300 * 1024);
        assert!(post(47933, "/event", Some("secret"), &big).starts_with("HTTP/1.1 413"));
        // Still alive afterwards.
        let ok = r#"{"hook_event_name":"UserPromptSubmit","cwd":"C:\\proj"}"#;
        post(47933, "/event", Some("secret"), ok);
        assert_eq!(rx.recv_timeout(Duration::from_secs(2)).unwrap().kind, "prompt");
    }

    #[test]
    fn all_scope_needs_no_folder_and_still_requires_the_token() {
        let (r, rx) = setup(47938);
        r.set_active(true); // default scope is All: nothing has to be chosen
        let any = r#"{"hook_event_name":"UserPromptSubmit","session_id":"s","cwd":"D:\\anywhere\\my-app"}"#;
        assert!(post(47938, "/event", Some("bad"), any).starts_with("HTTP/1.1 401"));
        post(47938, "/event", Some("secret"), any);
        let e = rx.recv_timeout(Duration::from_secs(2)).unwrap();
        assert_eq!((e.kind, e.project.as_deref()), ("prompt", Some("my-app")));
        // No cwd at all is fine too.
        post(47938, "/event", Some("secret"), r#"{"hook_event_name":"Stop"}"#);
        assert_eq!(rx.recv_timeout(Duration::from_secs(2)).unwrap().kind, "turn_stop");
    }

    struct FakeRoutes(Mutex<Vec<String>>);
    impl EditorRoutes for FakeRoutes {
        fn context(&self, body: &[u8]) -> bool {
            self.0.lock().unwrap().push(String::from_utf8_lossy(body).to_string());
            body != b"bad"
        }
        fn result(&self, _: &[u8]) -> bool {
            true
        }
        fn pending(&self) -> Option<String> {
            self.0.lock().unwrap().pop()
        }
    }

    fn get(port: u16, path: &str, token: Option<&str>) -> String {
        let mut s = TcpStream::connect(("127.0.0.1", port)).unwrap();
        s.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
        let auth = token.map(|t| format!("X-Sentiqx-Token: {t}\r\n")).unwrap_or_default();
        s.write_all(format!("GET {path} HTTP/1.1\r\nHost: x\r\n{auth}Connection: close\r\n\r\n").as_bytes()).unwrap();
        let mut out = String::new();
        let _ = s.read_to_string(&mut out);
        out
    }

    #[test]
    fn editor_routes_need_the_token_and_do_not_depend_on_monitoring() {
        let routes = Arc::new(FakeRoutes(Mutex::new(Vec::new())));
        let _r = start_with_routes(47940, "secret".into(), |_| {}, Some(routes.clone())).unwrap();
        assert!(post(47940, "/editor/context", None, "x").starts_with("HTTP/1.1 401"));
        assert!(get(47940, "/editor/pending", Some("nope")).starts_with("HTTP/1.1 401"));
        assert!(routes.0.lock().unwrap().is_empty());
        assert!(post(47940, "/editor/context", Some("secret"), "ok").starts_with("HTTP/1.1 200"));
        assert!(post(47940, "/editor/context", Some("secret"), "bad").starts_with("HTTP/1.1 400"));
        routes.0.lock().unwrap().clear();
        assert!(get(47940, "/editor/pending", Some("secret")).starts_with("HTTP/1.1 204"));
        routes.0.lock().unwrap().push("{\"id\":\"1\"}".into());
        assert!(get(47940, "/editor/pending", Some("secret")).contains("{\"id\":\"1\"}"));
    }

    #[test]
    fn editor_routes_do_not_exist_without_a_bridge() {
        let (_r, _rx) = setup(47941);
        assert!(post(47941, "/editor/context", Some("secret"), "x").starts_with("HTTP/1.1 404"));
        assert!(get(47941, "/editor/pending", Some("secret")).starts_with("HTTP/1.1 404"));
    }

    #[test]
    fn token_compare_is_exact() {
        assert!(tokens_match("abc", "abc"));
        assert!(!tokens_match("abc", "abd"));
        assert!(!tokens_match("abc", "abcd"));
    }
}
