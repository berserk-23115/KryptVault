mod crypto;
mod s3;
mod commands;

use commands::{AppState, encrypt_and_upload_file, download_and_decrypt_file, generate_keypair, encrypt_file_only, decrypt_file_only};
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      
      // Setup temp directory for encrypted files
      let temp_dir = std::env::temp_dir().join("krypt-vault");
      std::fs::create_dir_all(&temp_dir)?;
      
      // Initialize app state
      app.manage(AppState {
        temp_dir: Mutex::new(temp_dir),
      });
      
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      encrypt_and_upload_file,
      download_and_decrypt_file,
      generate_keypair,
      encrypt_file_only,
      decrypt_file_only
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
