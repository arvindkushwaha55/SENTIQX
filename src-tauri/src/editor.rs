//! Bridge to the SENTIQX VS Code extension. Code context stays in memory only and arrives
//! only when the user runs the command (or turned on automatic suggestions in the extension).
//! A fix is only ever handed over after the user approved it here, and the extension asks again.

use crate::receiver::EditorRoutes;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

pub const MAX_CODE_CHARS: usize = 64 * 1024;
const MAX_DIAGNOSTICS: usize = 50;
const MAX_MESSAGE_CHARS: usize = 500;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub line: u32,
    pub message: String,
    pub severity: String,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EditorContext {
    pub file: String,
    pub uri: String,
    pub language: String,
    pub version: i64,
    pub start_line: u32,
    pub end_line: u32,
    pub code: String,
    /// "selection" (the user ran the command) or "auto" (on save, if the user enabled it).
    pub trigger: String,
    #[serde(default)]
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApplyRequest {
    pub id: String,
    pub uri: String,
    pub version: i64,
    pub find: String,
    pub replace: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApplyResult {
    pub id: String,
    /// "applied", "declined", "stale" (the file changed) or "not_found".
    pub status: String,
}

/// Rejects anything malformed, oversized or with an unknown trigger.
pub fn parse_context(body: &[u8]) -> Option<EditorContext> {
    let mut c: EditorContext = serde_json::from_slice(body).ok()?;
    if c.code.chars().count() > MAX_CODE_CHARS || c.code.trim().is_empty() {
        return None;
    }
    if c.trigger != "selection" && c.trigger != "auto" {
        return None;
    }
    if c.end_line < c.start_line {
        return None;
    }
    // Only the file's name is kept for display, whatever the sender put here.
    c.file = c.file.rsplit(['\\', '/']).next().unwrap_or("").to_string();
    c.diagnostics.truncate(MAX_DIAGNOSTICS);
    for d in &mut c.diagnostics {
        d.message = d.message.chars().take(MAX_MESSAGE_CHARS).collect();
    }
    Some(c)
}

pub fn parse_result(body: &[u8]) -> Option<ApplyResult> {
    let r: ApplyResult = serde_json::from_slice(body).ok()?;
    matches!(r.status.as_str(), "applied" | "declined" | "stale" | "not_found").then_some(r)
}

type Emit<T> = Box<dyn Fn(T) + Send + Sync>;

pub struct EditorBridge {
    latest: Mutex<Option<EditorContext>>,
    pending: Mutex<Option<ApplyRequest>>,
    on_context: Emit<EditorContext>,
    on_result: Emit<ApplyResult>,
}

impl EditorBridge {
    pub fn new(on_context: Emit<EditorContext>, on_result: Emit<ApplyResult>) -> Self {
        Self { latest: Mutex::new(None), pending: Mutex::new(None), on_context, on_result }
    }

    pub fn latest(&self) -> Option<EditorContext> {
        self.latest.lock().ok().and_then(|l| l.clone())
    }

    /// Forgets the code held in memory.
    pub fn clear(&self) {
        if let Ok(mut l) = self.latest.lock() {
            *l = None;
        }
    }

    /// Only an edit against the code the extension sent can be queued, and only an exact one.
    pub fn request_apply(&self, req: ApplyRequest) -> Result<(), String> {
        let latest = self.latest().ok_or("no code context")?;
        if latest.uri != req.uri || latest.version != req.version {
            return Err("the file has changed since it was analysed".into());
        }
        if req.find.is_empty() || latest.code.matches(req.find.as_str()).count() != 1 {
            return Err("the fix does not match exactly one place in the selected code".into());
        }
        *self.pending.lock().map_err(|_| "lock error")? = Some(req);
        Ok(())
    }
}

impl EditorRoutes for EditorBridge {
    fn context(&self, body: &[u8]) -> bool {
        let Some(c) = parse_context(body) else { return false };
        if let Ok(mut l) = self.latest.lock() {
            *l = Some(c.clone());
        }
        (self.on_context)(c);
        true
    }

    fn result(&self, body: &[u8]) -> bool {
        let Some(r) = parse_result(body) else { return false };
        (self.on_result)(r);
        true
    }

    fn pending(&self) -> Option<String> {
        let req = self.pending.lock().ok()?.take()?;
        serde_json::to_string(&req).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::Arc;

    fn body(code: &str, trigger: &str) -> Vec<u8> {
        json!({"file": r"C:\secret-client\app\a.ts", "uri":"file:///a.ts", "language":"typescript", "version":3,
               "startLine":10, "endLine":12, "code":code, "trigger":trigger,
               "diagnostics":[{"line":11,"message":"m","severity":"error","source":"ts"}]})
        .to_string()
        .into_bytes()
    }

    fn bridge() -> Arc<EditorBridge> {
        Arc::new(EditorBridge::new(Box::new(|_| {}), Box::new(|_| {})))
    }

    #[test]
    fn keeps_only_the_file_name() {
        let c = parse_context(&body("let a = 1;", "selection")).unwrap();
        assert_eq!(c.file, "a.ts");
        assert_eq!(c.diagnostics.len(), 1);
    }

    #[test]
    fn rejects_bad_input() {
        assert!(parse_context(b"not json").is_none());
        assert!(parse_context(&body("   ", "selection")).is_none());
        assert!(parse_context(&body("x", "hacked")).is_none());
        assert!(parse_context(&body(&"x".repeat(MAX_CODE_CHARS + 1), "auto")).is_none());
        assert!(parse_result(br#"{"id":"1","status":"whatever"}"#).is_none());
        assert!(parse_result(br#"{"id":"1","status":"applied"}"#).is_some());
    }

    #[test]
    fn a_fix_must_match_the_analysed_code_exactly_once() {
        let b = bridge();
        let req = |find: &str, version| ApplyRequest { id: "1".into(), uri: "file:///a.ts".into(), version, find: find.into(), replace: "y".into() };
        assert!(b.request_apply(req("a", 3)).is_err(), "nothing analysed yet");
        assert!(b.context(&body("let a = a + 1;", "selection")));
        assert!(b.request_apply(req("a", 3)).is_err(), "appears more than once");
        assert!(b.request_apply(req("zzz", 3)).is_err(), "not present");
        assert!(b.request_apply(req("", 3)).is_err(), "empty");
        assert!(b.request_apply(req("let", 4)).is_err(), "file changed");
        assert!(b.pending().is_none());
        assert!(b.request_apply(req("let", 3)).is_ok());
    }

    #[test]
    fn a_pending_fix_is_handed_over_only_once() {
        let b = bridge();
        b.context(&body("let a;", "selection"));
        b.request_apply(ApplyRequest { id: "1".into(), uri: "file:///a.ts".into(), version: 3, find: "let".into(), replace: "const".into() }).unwrap();
        assert!(b.pending().is_some());
        assert!(b.pending().is_none());
    }

    #[test]
    fn clear_forgets_the_code() {
        let b = bridge();
        b.context(&body("let a;", "selection"));
        assert!(b.latest().is_some());
        b.clear();
        assert!(b.latest().is_none());
    }
}
