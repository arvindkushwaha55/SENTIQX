//! Local session history in SQLite. Only verified facts from reported events are stored:
//! tool names and counts, API error types, times, and the working folder's name.
//! Prompts, commands, tool output and raw error text are never written here.

use crate::normalize::ActivityEvent;
use rusqlite::{Connection, params};
use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ToolCount {
    pub tool: String,
    pub ok: i64,
    pub failed: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SessionRow {
    pub id: String,
    pub project: Option<String>,
    pub started_at: i64,
    pub last_at: i64,
    /// The last thing reported: "turn_stop", "api_error", "session_end" or something in progress.
    pub last_kind: String,
    pub tools: Vec<ToolCount>,
    pub api_errors: Vec<String>,
}

pub struct History {
    conn: Mutex<Connection>,
}

impl History {
    pub fn open(path: &Path) -> Result<Self, String> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        Self::init(Connection::open(path).map_err(|e| e.to_string())?)
    }

    pub fn in_memory() -> Result<Self, String> {
        Self::init(Connection::open_in_memory().map_err(|e| e.to_string())?)
    }

    fn init(conn: Connection) -> Result<Self, String> {
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
             CREATE TABLE IF NOT EXISTS sessions (
               id TEXT PRIMARY KEY, project TEXT, started_at INTEGER NOT NULL,
               last_at INTEGER NOT NULL, last_kind TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS tools (
               session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
               tool TEXT NOT NULL, ok INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0,
               PRIMARY KEY (session_id, tool));
             CREATE TABLE IF NOT EXISTS api_errors (
               session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
               at INTEGER NOT NULL, error_type TEXT NOT NULL);",
        )
        .map_err(|e| e.to_string())?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn record(&self, e: &ActivityEvent) -> Result<(), String> {
        if e.session_id.is_empty() {
            return Ok(()); // nothing reliable to file it under
        }
        let conn = self.conn.lock().map_err(|_| "history lock error")?;
        let at = e.at as i64;
        conn.execute(
            "INSERT INTO sessions (id, project, started_at, last_at, last_kind) VALUES (?1, ?2, ?3, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET last_at = ?3, last_kind = ?4, project = COALESCE(?2, project)",
            params![e.session_id, e.project, at, e.kind],
        )
        .map_err(|e| e.to_string())?;

        if e.kind == "tool_end" && e.interrupted != Some(true)
            && let (Some(tool), Some(ok)) = (&e.tool, e.ok)
        {
            let (o, f) = if ok { (1, 0) } else { (0, 1) };
            conn.execute(
                "INSERT INTO tools (session_id, tool, ok, failed) VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(session_id, tool) DO UPDATE SET ok = ok + ?3, failed = failed + ?4",
                params![e.session_id, tool, o, f],
            )
            .map_err(|e| e.to_string())?;
        }
        if e.kind == "api_error"
            && let Some(t) = &e.error_type
        {
            conn.execute(
                "INSERT INTO api_errors (session_id, at, error_type) VALUES (?1, ?2, ?3)",
                params![e.session_id, at, t],
            )
            .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn list(&self, limit: i64) -> Result<Vec<SessionRow>, String> {
        let conn = self.conn.lock().map_err(|_| "history lock error")?;
        let s = |e: rusqlite::Error| e.to_string();
        let mut stmt = conn
            .prepare("SELECT id, project, started_at, last_at, last_kind FROM sessions ORDER BY last_at DESC LIMIT ?1")
            .map_err(s)?;
        let mut rows: Vec<SessionRow> = stmt
            .query_map(params![limit], |r| {
                Ok(SessionRow {
                    id: r.get(0)?,
                    project: r.get(1)?,
                    started_at: r.get(2)?,
                    last_at: r.get(3)?,
                    last_kind: r.get(4)?,
                    tools: Vec::new(),
                    api_errors: Vec::new(),
                })
            })
            .map_err(s)?
            .collect::<Result<_, _>>()
            .map_err(s)?;
        let mut tools = conn
            .prepare("SELECT tool, ok, failed FROM tools WHERE session_id = ?1 ORDER BY ok + failed DESC, tool")
            .map_err(s)?;
        let mut errors = conn
            .prepare("SELECT error_type FROM api_errors WHERE session_id = ?1 ORDER BY at")
            .map_err(s)?;
        for row in &mut rows {
            row.tools = tools
                .query_map(params![row.id], |r| Ok(ToolCount { tool: r.get(0)?, ok: r.get(1)?, failed: r.get(2)? }))
                .map_err(s)?
                .collect::<Result<_, _>>()
                .map_err(s)?;
            row.api_errors = errors
                .query_map(params![row.id], |r| r.get(0))
                .map_err(s)?
                .collect::<Result<_, _>>()
                .map_err(s)?;
        }
        Ok(rows)
    }

    pub fn delete(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|_| "history lock error")?;
        conn.execute("DELETE FROM sessions WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Deletes everything and compacts the file, so deleted data does not linger on disk.
    pub fn clear(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|_| "history lock error")?;
        conn.execute_batch("DELETE FROM sessions; VACUUM;").map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::normalize::normalize;
    use serde_json::json;

    fn ev(v: serde_json::Value, at: u64) -> ActivityEvent {
        normalize(&v, at).unwrap()
    }

    fn sample(h: &History) {
        let base = |name: &str| json!({"hook_event_name": name, "session_id": "s1", "cwd": r"C:\work\shop"});
        h.record(&ev(base("UserPromptSubmit"), 100)).unwrap();
        let mut ok = base("PostToolUse");
        ok["tool_name"] = json!("Write");
        h.record(&ev(ok.clone(), 110)).unwrap();
        h.record(&ev(ok, 120)).unwrap();
        let mut bad = base("PostToolUseFailure");
        bad["tool_name"] = json!("Bash");
        bad["error"] = json!("TOP-SECRET output in the error");
        h.record(&ev(bad, 130)).unwrap();
        let mut cancelled = base("PostToolUseFailure");
        cancelled["tool_name"] = json!("Read");
        cancelled["is_interrupt"] = json!(true);
        h.record(&ev(cancelled, 135)).unwrap();
        h.record(&ev(base("Stop"), 140)).unwrap();
    }

    #[test]
    fn stores_verified_counts_and_times() {
        let h = History::in_memory().unwrap();
        sample(&h);
        let rows = h.list(10).unwrap();
        assert_eq!(rows.len(), 1);
        let r = &rows[0];
        assert_eq!((r.id.as_str(), r.project.as_deref(), r.started_at, r.last_at), ("s1", Some("shop"), 100, 140));
        assert_eq!(r.last_kind, "turn_stop");
        assert_eq!(
            r.tools,
            vec![
                ToolCount { tool: "Write".into(), ok: 2, failed: 0 },
                ToolCount { tool: "Bash".into(), ok: 0, failed: 1 },
            ],
            "cancelled tools count as neither"
        );
    }

    #[test]
    fn never_stores_raw_error_text() {
        let h = History::in_memory().unwrap();
        sample(&h);
        let dump = serde_json::to_string(&h.list(10).unwrap()).unwrap();
        assert!(!dump.contains("TOP-SECRET"));
        let conn = h.conn.lock().unwrap();
        let cols: i64 = conn
            .query_row("SELECT COUNT(*) FROM pragma_table_info('tools') WHERE name LIKE '%error%'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(cols, 0);
    }

    #[test]
    fn records_api_error_types() {
        let h = History::in_memory().unwrap();
        h.record(&ev(json!({"hook_event_name":"StopFailure","session_id":"s2","error":"rate_limit","error_details":"secret detail"}), 5)).unwrap();
        let r = &h.list(10).unwrap()[0];
        assert_eq!(r.api_errors, vec!["rate_limit".to_string()]);
        assert_eq!(r.last_kind, "api_error");
        assert!(!serde_json::to_string(r).unwrap().contains("secret detail"));
    }

    #[test]
    fn delete_one_and_delete_all_really_delete() {
        let h = History::in_memory().unwrap();
        sample(&h);
        h.record(&ev(json!({"hook_event_name":"Stop","session_id":"s3"}), 200)).unwrap();
        assert_eq!(h.list(10).unwrap().len(), 2);
        h.delete("s1").unwrap();
        let left = h.list(10).unwrap();
        assert_eq!(left.iter().map(|r| r.id.as_str()).collect::<Vec<_>>(), vec!["s3"]);
        let tools: i64 = h.conn.lock().unwrap().query_row("SELECT COUNT(*) FROM tools", [], |r| r.get(0)).unwrap();
        assert_eq!(tools, 0, "child rows go with the session");
        h.clear().unwrap();
        assert!(h.list(10).unwrap().is_empty());
    }

    #[test]
    fn events_without_a_session_are_not_filed() {
        let h = History::in_memory().unwrap();
        h.record(&ev(json!({"hook_event_name":"Stop"}), 1)).unwrap();
        assert!(h.list(10).unwrap().is_empty());
    }

    #[test]
    fn survives_reopening_the_file() {
        let dir = std::env::temp_dir().join(format!("sentiqx-hist-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let path = dir.join("history.db");
        sample(&History::open(&path).unwrap());
        assert_eq!(History::open(&path).unwrap().list(10).unwrap().len(), 1);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
