pub mod db;

use db::Database;
use std::sync::Mutex;

/// Shared database state
pub struct StorageState {
    pub db: Mutex<Database>,
}

impl StorageState {
    pub fn new(app_data_dir: &std::path::Path) -> Result<Self, String> {
        let db_path = app_data_dir.join("attunely.db");
        let db = Database::open(&db_path)?;
        Ok(Self {
            db: Mutex::new(db),
        })
    }
}
