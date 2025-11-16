use crate::crypto::{
    encrypt_file, decrypt_file, decrypt_file_with_dek, generate_server_keypair, generate_user_keypair,
    wrap_dek_for_recipient, unwrap_dek_for_user, encrypt_with_key, decrypt_with_key,
    EncryptionResult, DecryptionParams, UserKeypair,
};
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

// ============================================================================
// USER KEYPAIR MANAGEMENT
// ============================================================================

/// Generate new user keypairs (X25519 + Ed25519)
/// Private keys should be stored in OS keychain, public keys sent to server
#[tauri::command]
pub fn generate_user_keypair_command() -> Result<UserKeypair, String> {
    generate_user_keypair()
        .map_err(|e| format!("Failed to generate user keypair: {}", e))
}

/// Wrap a DEK for sharing with another user
/// Takes the DEK (in base64), unwraps it with current user's private key,
/// then re-wraps it with recipient's public key
#[tauri::command]
pub fn share_file_key(
    wrapped_dek: String,
    user_public_key: String,
    user_private_key: String,
    recipient_public_key: String,
) -> Result<String, String> {
    // First, unwrap the DEK using the current user's keypair
    let dek = unwrap_dek_for_user(&wrapped_dek, &user_public_key, &user_private_key)
        .map_err(|e| format!("Failed to unwrap DEK: {}", e))?;
    
    // Then, wrap it for the recipient
    wrap_dek_for_recipient(&dek, &recipient_public_key)
        .map_err(|e| format!("Failed to wrap DEK for recipient: {}", e))
}

/// Unwrap a DEK that was shared with the current user
#[tauri::command]
pub fn unwrap_shared_dek(
    wrapped_dek: String,
    user_public_key: String,
    user_private_key: String,
) -> Result<String, String> {
    let dek = unwrap_dek_for_user(&wrapped_dek, &user_public_key, &user_private_key)
        .map_err(|e| format!("Failed to unwrap DEK: {}", e))?;
    
    Ok(base64::encode(&dek))
}

/// Download and decrypt a shared file using an already-unwrapped DEK
/// Used for files shared with the current user
#[tauri::command]
pub async fn download_and_decrypt_shared_file(
    download_url: String,
    dek_base64: String,
    nonce: String,
    output_path: String,
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
        .get(&download_url)
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
    
    // Decrypt the file using the unwrapped DEK
    let decrypted_path = decrypt_file_with_dek(
        encrypted_path.to_str().unwrap(),
        &dek_base64,
        &nonce,
        &output_path,
    )
    .map_err(|e| format!("Decryption failed: {}", e))?;
    
    // Clean up encrypted temp file
    if let Err(e) = std::fs::remove_file(&encrypted_path) {
        log::warn!("Failed to remove temp encrypted file: {}", e);
    }
    
    Ok(decrypted_path)
}

// ============================================================================
// FOLDER KEY MANAGEMENT
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct WrapDekWithFolderKeyParams {
    pub dek_b64: String,           // File's DEK in base64
    pub folder_key_b64: String,    // Folder key in base64
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WrapDekWithFolderKeyResult {
    pub wrapped_dek: String,       // Base64
    pub wrapping_nonce: String,    // Base64
}

/// Wrap a file's DEK with a folder key (symmetric encryption)
#[tauri::command]
pub fn wrap_dek_with_folder_key(
    params: WrapDekWithFolderKeyParams,
) -> Result<WrapDekWithFolderKeyResult, String> {
    // Decode the DEK and folder key
    let dek = base64::decode(&params.dek_b64)
        .map_err(|e| format!("Failed to decode DEK: {}", e))?;
    
    let folder_key_vec = base64::decode(&params.folder_key_b64)
        .map_err(|e| format!("Failed to decode folder key: {}", e))?;
    
    if folder_key_vec.len() != 32 {
        return Err("Invalid folder key size".to_string());
    }
    
    let mut folder_key = [0u8; 32];
    folder_key.copy_from_slice(&folder_key_vec);
    
    // Encrypt DEK with folder key
    let (wrapped_dek, wrapping_nonce) = encrypt_with_key(&dek, &folder_key)
        .map_err(|e| format!("Failed to wrap DEK: {}", e))?;
    
    Ok(WrapDekWithFolderKeyResult {
        wrapped_dek,
        wrapping_nonce,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UnwrapDekWithFolderKeyParams {
    pub wrapped_dek: String,       // Base64
    pub wrapping_nonce: String,    // Base64
    pub folder_key_b64: String,    // Folder key in base64
}

/// Unwrap a file's DEK using a folder key
#[tauri::command]
pub fn unwrap_dek_with_folder_key(
    params: UnwrapDekWithFolderKeyParams,
) -> Result<String, String> {
    // Decode folder key
    let folder_key_vec = base64::decode(&params.folder_key_b64)
        .map_err(|e| format!("Failed to decode folder key: {}", e))?;
    
    if folder_key_vec.len() != 32 {
        return Err("Invalid folder key size".to_string());
    }
    
    let mut folder_key = [0u8; 32];
    folder_key.copy_from_slice(&folder_key_vec);
    
    // Decrypt DEK with folder key
    let dek = decrypt_with_key(&params.wrapped_dek, &params.wrapping_nonce, &folder_key)
        .map_err(|e| format!("Failed to unwrap DEK: {}", e))?;
    
    Ok(base64::encode(&dek))
}

/// Generate a random folder key (256-bit)
#[tauri::command]
pub fn generate_folder_key() -> Result<String, String> {
    use rand::RngCore;
    let mut folder_key = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut folder_key);
    Ok(base64::encode(&folder_key))
}

/// Seal data with a recipient's public key (sealed box)
#[tauri::command]
pub fn seal_data(
    data: String,
    recipient_public_key: String,
) -> Result<String, String> {
    use sodiumoxide::crypto::sealedbox;
    use sodiumoxide::crypto::box_::PublicKey;
    
    // Decode the data from base64
    let data_bytes = base64::decode(&data)
        .map_err(|e| format!("Failed to decode data: {}", e))?;
    
    // Decode recipient's public key
    let pk_bytes = base64::decode(&recipient_public_key)
        .map_err(|e| format!("Failed to decode public key: {}", e))?;
    
    let public_key = PublicKey::from_slice(&pk_bytes)
        .ok_or_else(|| "Invalid public key".to_string())?;
    
    // Seal the data
    let sealed = sealedbox::seal(&data_bytes, &public_key);
    
    // Return base64 encoded sealed box
    Ok(base64::encode(&sealed))
}
