use anyhow::{Context, Result};
use reqwest::multipart;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Read;

#[derive(Debug, Serialize, Deserialize)]
pub struct PresignedUrlResponse {
    pub url: String,
    pub fields: std::collections::HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct S3UploadResult {
    pub success: bool,
    pub file_key: String,
    pub bucket: String,
}

/// Upload encrypted file to S3 using presigned URL
pub async fn upload_to_s3(
    file_path: &str,
    presigned_url: &str,
    file_key: &str,
) -> Result<S3UploadResult> {
    // Read the encrypted file
    let mut file = File::open(file_path)
        .context("Failed to open encrypted file for upload")?;
    
    let mut file_contents = Vec::new();
    file.read_to_end(&mut file_contents)
        .context("Failed to read encrypted file")?;
    
    // Create HTTP client
    let client = reqwest::Client::new();
    
    // Upload using PUT request (simple presigned URL)
    let response = client
        .put(presigned_url)
        .header("Content-Type", "application/octet-stream")
        .body(file_contents)
        .send()
        .await
        .context("Failed to upload file to S3")?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_body = response.text().await.unwrap_or_default();
        return Err(anyhow::anyhow!(
            "S3 upload failed with status {}: {}",
            status,
            error_body
        ));
    }
    
    Ok(S3UploadResult {
        success: true,
        file_key: file_key.to_string(),
        bucket: "krypt-vault-files".to_string(),
    })
}

/// Upload using POST presigned URL with form fields (alternative method)
pub async fn upload_to_s3_post(
    file_path: &str,
    presigned_data: PresignedUrlResponse,
) -> Result<S3UploadResult> {
    // Read the encrypted file
    let mut file = File::open(file_path)
        .context("Failed to open encrypted file for upload")?;
    
    let mut file_contents = Vec::new();
    file.read_to_end(&mut file_contents)
        .context("Failed to read encrypted file")?;
    
    // Create HTTP client
    let client = reqwest::Client::new();
    
    // Build multipart form
    let mut form = multipart::Form::new();
    
    // Add all fields from presigned URL
    for (key, value) in presigned_data.fields.iter() {
        form = form.text(key.clone(), value.clone());
    }
    
    // Add the file
    let file_part = multipart::Part::bytes(file_contents)
        .file_name("file")
        .mime_str("application/octet-stream")?;
    
    form = form.part("file", file_part);
    
    // Upload
    let response = client
        .post(&presigned_data.url)
        .multipart(form)
        .send()
        .await
        .context("Failed to upload file to S3")?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_body = response.text().await.unwrap_or_default();
        return Err(anyhow::anyhow!(
            "S3 upload failed with status {}: {}",
            status,
            error_body
        ));
    }
    
    Ok(S3UploadResult {
        success: true,
        file_key: presigned_data.fields.get("key")
            .cloned()
            .unwrap_or_default(),
        bucket: "krypt-vault-files".to_string(),
    })
}
