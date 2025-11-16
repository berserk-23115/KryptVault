import { invoke } from "@tauri-apps/api/core";

export interface EncryptionResult {
  encrypted_file_path: string;
  wrapped_dek: string;
  nonce: string;
  file_size: number;
  original_filename: string;
}

export interface FileUploadParams {
  file_path: string;
  server_public_key: string;
  presigned_url: string;
  file_key: string;
}

export interface FileUploadResponse {
  success: boolean;
  file_key: string;
  wrapped_dek: string;
  nonce: string;
  file_size: number;
  original_filename: string;
}

export interface FileDownloadParams {
  download_url: string;
  wrapped_dek: string;
  nonce: string;
  server_public_key: string;
  server_private_key: string;
  output_path: string;
}

export interface DecryptionParams {
  encrypted_file_path: string;
  wrapped_dek: string;
  nonce: string;
  server_private_key: string;
}

export interface UserKeypair {
  x25519_public_key: string;
  x25519_private_key: string;
  ed25519_public_key: string;
  ed25519_private_key: string;
}

export interface WrapDekWithFolderKeyParams {
  dek_b64: string;
  folder_key_b64: string;
}

export interface WrapDekWithFolderKeyResult {
  wrapped_dek: string;
  wrapping_nonce: string;
}

export interface UnwrapDekWithFolderKeyParams {
  wrapped_dek: string;
  wrapping_nonce: string;
  folder_key_b64: string;
}

/**
 * Encrypt and upload a file to S3
 */
export async function encryptAndUploadFile(
  params: FileUploadParams
): Promise<FileUploadResponse> {
  return await invoke<FileUploadResponse>("encrypt_and_upload_file", { params });
}

/**
 * Download and decrypt a file from S3
 */
export async function downloadAndDecryptFile(
  params: FileDownloadParams
): Promise<string> {
  return await invoke<string>("download_and_decrypt_file", { params });
}

/**
 * Generate a new server keypair (for testing/development)
 */
export async function generateKeypair(): Promise<[string, string]> {
  return await invoke<[string, string]>("generate_keypair");
}

/**
 * Encrypt a file locally without uploading
 */
export async function encryptFileOnly(
  inputPath: string,
  outputPath: string,
  serverPublicKey: string
): Promise<EncryptionResult> {
  return await invoke<EncryptionResult>("encrypt_file_only", {
    inputPath,
    outputPath,
    serverPublicKey,
  });
}

/**
 * Decrypt a file locally without downloading
 */
export async function decryptFileOnly(
  params: DecryptionParams,
  outputPath: string,
  serverPublicKey: string
): Promise<string> {
  return await invoke<string>("decrypt_file_only", {
    params,
    outputPath,
    serverPublicKey,
  });
}

// ============================================================================
// USER KEYPAIR MANAGEMENT
// ============================================================================

/**
 * Generate new user keypairs (X25519 for encryption + Ed25519 for signing)
 */
export async function generateUserKeypair(): Promise<UserKeypair> {
  return await invoke<UserKeypair>("generate_user_keypair_command");
}

/**
 * Share a file key with another user
 * Unwraps the DEK with current user's private key, then wraps it with recipient's public key
 */
export async function shareFileKey(
  wrappedDek: string,
  userPublicKey: string,
  userPrivateKey: string,
  recipientPublicKey: string
): Promise<string> {
  return await invoke<string>("share_file_key", {
    wrappedDek,
    userPublicKey,
    userPrivateKey,
    recipientPublicKey,
  });
}

/**
 * Unwrap a DEK that was shared with the current user
 */
export async function unwrapSharedDek(
  wrappedDek: string,
  userPublicKey: string,
  userPrivateKey: string
): Promise<string> {
  return await invoke<string>("unwrap_shared_dek", {
    wrappedDek,
    userPublicKey,
    userPrivateKey,
  });
}

// ============================================================================
// FOLDER KEY MANAGEMENT
// ============================================================================

/**
 * Generate a random folder key (256-bit)
 */
export async function generateFolderKey(): Promise<string> {
  return await invoke<string>("generate_folder_key");
}

/**
 * Wrap a file's DEK with a folder key
 */
export async function wrapDekWithFolderKey(
  params: WrapDekWithFolderKeyParams
): Promise<WrapDekWithFolderKeyResult> {
  return await invoke<WrapDekWithFolderKeyResult>("wrap_dek_with_folder_key", {
    params,
  });
}

/**
 * Unwrap a file's DEK using a folder key
 */
export async function unwrapDekWithFolderKey(
  params: UnwrapDekWithFolderKeyParams
): Promise<string> {
  return await invoke<string>("unwrap_dek_with_folder_key", {
    params,
  });
}
