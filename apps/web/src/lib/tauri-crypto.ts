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
