use crate::crypto::{encrypt_file, decrypt_file, generate_server_keypair, EncryptionResult, DecryptionParams};
use crate::s3::{upload_to_s3, S3UploadResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::State;
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileUploadParams {
    pub file_path: String,
    pub server_public_key: String,
    pub presigned_url: String,
    pub file_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileUploadResponse {
    pub success: bool,
    pub file_key: String,
    pub wrapped_dek: String,
    pub nonce: String,
    pub file_size: u64,
    pub original_filename: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileDownloadParams {
    pub download_url: String,
    pub wrapped_dek: String,
    pub nonce: String,
    pub server_public_key: String,
    pub server_private_key: String,
    pub output_path: String,
}

pub struct AppState {
    pub temp_dir: Mutex<PathBuf>,
}

/// Tauri command to encrypt and upload a file
#[tauri::command]
pub async fn encrypt_and_upload_file(
    params: FileUploadParams,
    state: State<'_, AppState>,
) -> Result<FileUploadResponse, String> {
    // Get temp directory
    let temp_dir = state.temp_dir.lock().unwrap().clone();
    
    // Generate unique filename for encrypted file
    let file_id = uuid::Uuid::new_v4().to_string();
    let encrypted_path = temp_dir.join(format!("{}.enc", file_id));
    
    // Encrypt the file
    let encryption_result = encrypt_file(
        &params.file_path,
        encrypted_path.to_str().unwrap(),
        &params.server_public_key,
    )
    .map_err(|e| format!("Encryption failed: {}", e))?;
    
    // Upload to S3
    let upload_result = upload_to_s3(
        &encryption_result.encrypted_file_path,
        &params.presigned_url,
        &params.file_key,
    )
    .await
    .map_err(|e| format!("S3 upload failed: {}", e))?;
    
    // Clean up encrypted temp file
    if let Err(e) = std::fs::remove_file(&encryption_result.encrypted_file_path) {
        log::warn!("Failed to remove temp encrypted file: {}", e);
    }
    
    Ok(FileUploadResponse {
        success: upload_result.success,
        file_key: upload_result.file_key,
        wrapped_dek: encryption_result.wrapped_dek,
        nonce: encryption_result.nonce,
        file_size: encryption_result.file_size,
        original_filename: encryption_result.original_filename,
    })
}

/// Tauri command to download and decrypt a file
#[tauri::command]
pub async fn download_and_decrypt_file(
    params: FileDownloadParams,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // Get temp directory
    let temp_dir = state.temp_dir.lock().unwrap().clone();
    
    // Generate unique filename for downloaded encrypted file
    let file_id = uuid::Uuid::new_v4().to_string();
    let encrypted_path = temp_dir.join(format!("{}.enc", file_id));
    
    // Download the encrypted file from S3
    let client = reqwest::Client::new();
    let response = client
        .get(&params.download_url)
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }
    
    let encrypted_data = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read downloaded data: {}", e))?;
    
    // Save encrypted file temporarily
    std::fs::write(&encrypted_path, encrypted_data)
        .map_err(|e| format!("Failed to save encrypted file: {}", e))?;
    
    // Decrypt the file
    let decryption_params = DecryptionParams {
        encrypted_file_path: encrypted_path.to_str().unwrap().to_string(),
        wrapped_dek: params.wrapped_dek,
        nonce: params.nonce,
        server_private_key: params.server_private_key,
    };
    
    let decrypted_path = decrypt_file(
        decryption_params,
        &params.output_path,
        &params.server_public_key,
    )
    .map_err(|e| format!("Decryption failed: {}", e))?;
    
    // Clean up encrypted temp file
    if let Err(e) = std::fs::remove_file(&encrypted_path) {
        log::warn!("Failed to remove temp encrypted file: {}", e);
    }
    
    Ok(decrypted_path)
}

/// Tauri command to generate server keypair (for initial setup)
#[tauri::command]
pub fn generate_keypair() -> Result<(String, String), String> {
    generate_server_keypair()
        .map_err(|e| format!("Failed to generate keypair: {}", e))
}

/// Tauri command to encrypt a file locally (without upload)
#[tauri::command]
pub fn encrypt_file_only(
    input_path: String,
    output_path: String,
    server_public_key: String,
) -> Result<EncryptionResult, String> {
    encrypt_file(&input_path, &output_path, &server_public_key)
        .map_err(|e| format!("Encryption failed: {}", e))
}

/// Tauri command to decrypt a file locally (without download)
#[tauri::command]
pub fn decrypt_file_only(
    params: DecryptionParams,
    output_path: String,
    server_public_key: String,
) -> Result<String, String> {
    decrypt_file(params, &output_path, &server_public_key)
        .map_err(|e| format!("Decryption failed: {}", e))
}
