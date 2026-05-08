pub mod db;

use db::Database;
use std::sync::Mutex;

/// Shared database state
pub struct StorageState {
    pub db: Mutex<Database>,
}

unsafe impl Send for StorageState {}
unsafe impl Sync for StorageState {}

impl StorageState {
    pub fn new(app_data_dir: &std::path::Path) -> Result<Self, String> {
        let db_path = app_data_dir.join("tunesoar.db");
        let db = Database::open(&db_path)?;
        Ok(Self {
            db: Mutex::new(db),
        })
    }
}
