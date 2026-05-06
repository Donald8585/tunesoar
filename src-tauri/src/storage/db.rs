use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::audio::ContextType;

/// SQLite-backed storage for user preferences, context mappings, and usage logs
pub struct Database {
    conn: Connection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPrefs {
    pub volume: f32,
    pub carrier_frequency: f32,
    pub detection_interval_secs: u64,
    pub auto_start: bool,
    pub minimize_to_tray: bool,
    pub telemetry_opt_in: bool,
    pub pro_license_key: Option<String>,
    pub safety_warning_accepted: bool,
}

impl Default for UserPrefs {
    fn default() -> Self {
        Self {
            volume: 0.10,
            carrier_frequency: 200.0,
            detection_interval_secs: 3,
            auto_start: true,
            minimize_to_tray: true,
            telemetry_opt_in: false,
            pro_license_key: None,
            safety_warning_accepted: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextMapping {
    pub id: Option<i64>,
    pub pattern: String,
    pub pattern_type: String, // "app" or "url"
    pub context_type: String,
    pub beat_type: String,
    pub beat_frequency: f32,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageLog {
    pub id: Option<i64>,
    pub context_type: String,
    pub beat_type: String,
    pub app_name: String,
    pub duration_secs: i64,
    pub timestamp: i64,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self, String> {
        let conn = Connection::open(path)
            .map_err(|e| format!("Failed to open database: {}", e))?;

        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> Result<(), String> {
        self.conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS user_prefs (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS context_mappings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pattern TEXT NOT NULL,
                pattern_type TEXT NOT NULL DEFAULT 'app',
                context_type TEXT NOT NULL,
                beat_type TEXT NOT NULL,
                beat_frequency REAL NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL DEFAULT (unixepoch()),
                UNIQUE(pattern, pattern_type)
            );

            CREATE TABLE IF NOT EXISTS usage_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                context_type TEXT NOT NULL,
                beat_type TEXT NOT NULL,
                app_name TEXT NOT NULL,
                duration_secs INTEGER NOT NULL,
                timestamp INTEGER NOT NULL DEFAULT (unixepoch())
            );

            CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_logs(timestamp);
            ",
        )
        .map_err(|e| format!("Migration failed: {}", e))?;

        Ok(())
    }

    // --- User Preferences ---

    pub fn get_prefs(&self) -> Result<UserPrefs, String> {
        let mut prefs = UserPrefs::default();

        let mut stmt = self.conn
            .prepare("SELECT key, value FROM user_prefs")
            .map_err(|e| format!("{}", e))?;

        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| format!("{}", e))?;

        for row in rows {
            let (key, value) = row.map_err(|e| format!("{}", e))?;
            match key.as_str() {
                "volume" => prefs.volume = value.parse().unwrap_or(0.10),
                "carrier_frequency" => prefs.carrier_frequency = value.parse().unwrap_or(200.0),
                "detection_interval_secs" => prefs.detection_interval_secs = value.parse().unwrap_or(3),
                "auto_start" => prefs.auto_start = value.parse().unwrap_or(true),
                "minimize_to_tray" => prefs.minimize_to_tray = value.parse().unwrap_or(true),
                "telemetry_opt_in" => prefs.telemetry_opt_in = value.parse().unwrap_or(false),
                "pro_license_key" => prefs.pro_license_key = Some(value).filter(|v| !v.is_empty()),
                "safety_warning_accepted" => prefs.safety_warning_accepted = value.parse().unwrap_or(false),
                _ => {}
            }
        }

        Ok(prefs)
    }

    pub fn save_pref(&self, key: &str, value: &str) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT INTO user_prefs (key, value) VALUES (?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value = ?2",
                params![key, value],
            )
            .map_err(|e| format!("{}", e))?;
        Ok(())
    }

    // --- Context Mappings ---

    pub fn get_mappings(&self) -> Result<Vec<ContextMapping>, String> {
        let mut stmt = self.conn
            .prepare(
                "SELECT id, pattern, pattern_type, context_type, beat_type, beat_frequency, enabled
                 FROM context_mappings ORDER BY pattern_type, pattern",
            )
            .map_err(|e| format!("{}", e))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(ContextMapping {
                    id: Some(row.get(0)?),
                    pattern: row.get(1)?,
                    pattern_type: row.get(2)?,
                    context_type: row.get(3)?,
                    beat_type: row.get(4)?,
                    beat_frequency: row.get(5)?,
                    enabled: row.get::<_, i32>(6)? != 0,
                })
            })
            .map_err(|e| format!("{}", e))?;

        let mut mappings = Vec::new();
        for row in rows {
            mappings.push(row.map_err(|e| format!("{}", e))?);
        }
        Ok(mappings)
    }

    pub fn upsert_mapping(&self, mapping: &ContextMapping) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT INTO context_mappings (pattern, pattern_type, context_type, beat_type, beat_frequency, enabled)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(pattern, pattern_type) DO UPDATE SET
                 context_type = ?3, beat_type = ?4, beat_frequency = ?5, enabled = ?6",
                params![
                    mapping.pattern,
                    mapping.pattern_type,
                    mapping.context_type,
                    mapping.beat_type,
                    mapping.beat_frequency,
                    mapping.enabled as i32,
                ],
            )
            .map_err(|e| format!("{}", e))?;
        Ok(())
    }

    pub fn delete_mapping(&self, id: i64) -> Result<(), String> {
        self.conn
            .execute("DELETE FROM context_mappings WHERE id = ?1", params![id])
            .map_err(|e| format!("{}", e))?;
        Ok(())
    }

    // --- Usage Logs ---

    pub fn log_usage(&self, log: &UsageLog) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT INTO usage_logs (context_type, beat_type, app_name, duration_secs, timestamp)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    log.context_type,
                    log.beat_type,
                    log.app_name,
                    log.duration_secs,
                    log.timestamp,
                ],
            )
            .map_err(|e| format!("{}", e))?;
        Ok(())
    }

    pub fn get_usage_stats(&self, days: i64) -> Result<Vec<(String, i64)>, String> {
        let cutoff = chrono::Utc::now().timestamp() - (days * 86400);
        let mut stmt = self.conn
            .prepare(
                "SELECT context_type, SUM(duration_secs) as total
                 FROM usage_logs
                 WHERE timestamp > ?1
                 GROUP BY context_type
                 ORDER BY total DESC",
            )
            .map_err(|e| format!("{}", e))?;

        let rows = stmt
            .query_map(params![cutoff], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
            })
            .map_err(|e| format!("{}", e))?;

        let mut stats = Vec::new();
        for row in rows {
            stats.push(row.map_err(|e| format!("{}", e))?);
        }
        Ok(stats)
    }
}
