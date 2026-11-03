//! Turns a raw Claude Code hook payload into the small, privacy-minimal event SENTIQX uses.
//!
//! Only these fields are ever read: `hook_event_name`, `session_id`, `tool_name`,
//! `tool_use_id`, `is_interrupt`, and for failures `error` / `error_details`
//! (truncated). Prompts, tool inputs, tool responses and file contents are never read.

use serde::Serialize;
use serde_json::Value;

const MAX_TEXT_CHARS: usize = 300;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEvent {
    pub kind: &'static str,
    pub at: u64,
    pub session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ok: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interrupted: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

fn text(v: &Value, key: &str) -> Option<String> {
    v.get(key)?.as_str().map(str::to_owned)
}

fn truncated(v: &Value, key: &str) -> Option<String> {
    let s = text(v, key)?;
    if s.chars().count() <= MAX_TEXT_CHARS {
        return Some(s);
    }
    let cut: String = s.chars().take(MAX_TEXT_CHARS).collect();
    Some(format!("{cut}..."))
}

fn base(kind: &'static str, at: u64, payload: &Value) -> ActivityEvent {
    ActivityEvent {
        kind,
        at,
        session_id: text(payload, "session_id").unwrap_or_default(),
        tool: None,
        id: None,
        ok: None,
        interrupted: None,
        error: None,
        error_type: None,
        detail: None,
    }
}

/// Returns `None` for events SENTIQX does not use, and for tool events without a tool
/// name (it never invents one).
pub fn normalize(payload: &Value, at: u64) -> Option<ActivityEvent> {
    let name = payload.get("hook_event_name")?.as_str()?;
    match name {
        "SessionStart" => Some(base("session_start", at, payload)),
        "UserPromptSubmit" => Some(base("prompt", at, payload)),
        "Stop" => Some(base("turn_stop", at, payload)),
        "SessionEnd" => Some(base("session_end", at, payload)),
        "PreToolUse" | "PermissionRequest" | "PostToolUse" | "PostToolUseFailure" => {
            let tool = text(payload, "tool_name")?;
            let mut e = base(
                match name {
                    "PreToolUse" => "tool_start",
                    "PermissionRequest" => "permission_request",
                    _ => "tool_end",
                },
                at,
                payload,
            );
            e.tool = Some(tool);
            if name != "PermissionRequest" {
                e.id = text(payload, "tool_use_id");
            }
            match name {
                "PostToolUse" => e.ok = Some(true),
                "PostToolUseFailure" => {
                    e.ok = Some(false);
                    let interrupted = payload
                        .get("is_interrupt")
                        .and_then(Value::as_bool)
                        .unwrap_or(false);
                    if interrupted {
                        e.interrupted = Some(true);
                    }
                    e.error = truncated(payload, "error");
                }
                _ => {}
            }
            Some(e)
        }
        "StopFailure" => {
            let mut e = base("api_error", at, payload);
            e.error_type = Some(text(payload, "error").unwrap_or_else(|| "unknown".into()));
            e.detail = truncated(payload, "error_details");
            Some(e)
        }
        _ => None,
    }
}

/// True when `cwd` is the project folder or inside it (Windows-style, case-insensitive).
pub fn path_within(project: &str, cwd: &str) -> bool {
    fn norm(p: &str) -> String {
        let p = p.trim().replace('/', "\\");
        let p = p.strip_prefix("\\\\?\\").unwrap_or(&p);
        p.trim_end_matches('\\').to_lowercase()
    }
    let (project, cwd) = (norm(project), norm(cwd));
    !project.is_empty() && (cwd == project || cwd.starts_with(&format!("{project}\\")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn maps_core_events() {
        let n = |v: Value| normalize(&v, 5).map(|e| e.kind);
        assert_eq!(n(json!({"hook_event_name":"SessionStart"})), Some("session_start"));
        assert_eq!(n(json!({"hook_event_name":"UserPromptSubmit","prompt":"secret"})), Some("prompt"));
        assert_eq!(n(json!({"hook_event_name":"Stop"})), Some("turn_stop"));
        assert_eq!(n(json!({"hook_event_name":"SessionEnd"})), Some("session_end"));
        assert_eq!(n(json!({"hook_event_name":"PreToolUse","tool_name":"Write"})), Some("tool_start"));
        assert_eq!(n(json!({"hook_event_name":"PermissionRequest","tool_name":"Bash"})), Some("permission_request"));
        assert_eq!(n(json!({"hook_event_name":"PostToolUse","tool_name":"Write"})), Some("tool_end"));
    }

    #[test]
    fn ignores_unknown_events_and_never_invents_a_tool() {
        assert!(normalize(&json!({"hook_event_name":"CwdChanged"}), 1).is_none());
        assert!(normalize(&json!({"hook_event_name":"PreToolUse"}), 1).is_none());
        assert!(normalize(&json!({"nothing":true}), 1).is_none());
    }

    #[test]
    fn never_leaks_prompt_or_tool_content() {
        let payload = json!({
            "hook_event_name": "PostToolUse",
            "session_id": "s1",
            "tool_name": "Bash",
            "tool_use_id": "t1",
            "tool_input": {"command": "echo TOP-SECRET-COMMAND"},
            "tool_response": {"stdout": "TOP-SECRET-OUTPUT"},
            "prompt": "TOP-SECRET-PROMPT"
        });
        let e = normalize(&payload, 1).unwrap();
        let out = serde_json::to_string(&e).unwrap();
        assert!(!out.contains("TOP-SECRET"));
        assert_eq!(e.ok, Some(true));
        assert_eq!(e.id.as_deref(), Some("t1"));
    }

    #[test]
    fn failure_keeps_truncated_error_and_interrupt_flag() {
        let long = "x".repeat(1000);
        let e = normalize(
            &json!({"hook_event_name":"PostToolUseFailure","tool_name":"Bash","error":long,"is_interrupt":true}),
            1,
        )
        .unwrap();
        assert_eq!(e.ok, Some(false));
        assert_eq!(e.interrupted, Some(true));
        assert!(e.error.unwrap().chars().count() <= MAX_TEXT_CHARS + 3);
    }

    #[test]
    fn stop_failure_becomes_api_error() {
        let e = normalize(
            &json!({"hook_event_name":"StopFailure","error":"rate_limit","error_details":"429"}),
            1,
        )
        .unwrap();
        assert_eq!((e.kind, e.error_type.as_deref(), e.detail.as_deref()), ("api_error", Some("rate_limit"), Some("429")));
    }

    #[test]
    fn serialises_with_camel_case_for_the_frontend() {
        let e = normalize(&json!({"hook_event_name":"StopFailure","error":"overloaded"}), 9).unwrap();
        let v = serde_json::to_value(&e).unwrap();
        assert_eq!(v["errorType"], "overloaded");
        assert_eq!(v["kind"], "api_error");
        assert!(v.get("tool").is_none());
    }

    #[test]
    fn path_filter_matches_only_the_project() {
        assert!(path_within(r"C:\Users\arvin\proj", r"C:\Users\arvin\proj"));
        assert!(path_within(r"C:\Users\arvin\proj\", r"c:/users/arvin/PROJ/src"));
        assert!(path_within(r"\\?\C:\proj", r"C:\proj\a"));
        assert!(!path_within(r"C:\Users\arvin\proj", r"C:\Users\arvin\proj2"));
        assert!(!path_within(r"C:\Users\arvin\proj", r"C:\Users\arvin"));
        assert!(!path_within("", r"C:\x"));
    }
}
