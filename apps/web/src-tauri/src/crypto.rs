use anyhow::{Context, Result};
use chacha20poly1305::{
    aead::{Aead, KeyInit, OsRng},
    XChaCha20Poly1305, XNonce,
};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sodiumoxide::crypto::sealedbox;
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

const NONCE_SIZE: usize = 24; // XChaCha20 uses 192-bit nonces
const KEY_SIZE: usize = 32; // 256-bit key

#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptionResult {
    pub encrypted_file_path: String,
    pub wrapped_dek: String, // Base64 encoded sealed box containing DEK
    pub nonce: String,        // Base64 encoded nonce
    pub file_size: u64,
    pub original_filename: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DecryptionParams {
    pub encrypted_file_path: String,
    pub wrapped_dek: String,
    pub nonce: String,
    pub server_private_key: String, // Base64 encoded server private key for unsealing
}

/// Generate a random 256-bit DEK (Data Encryption Key)
fn generate_dek() -> [u8; KEY_SIZE] {
    let mut dek = [0u8; KEY_SIZE];
    OsRng.fill_bytes(&mut dek);
    dek
}

/// Generate a random 192-bit nonce for XChaCha20
fn generate_nonce() -> [u8; NONCE_SIZE] {
    let mut nonce = [0u8; NONCE_SIZE];
    OsRng.fill_bytes(&mut nonce);
    nonce
}

/// Wrap (seal) the DEK using libsodium sealed box with server's public key
pub fn wrap_dek(dek: &[u8; KEY_SIZE], server_public_key: &str) -> Result<String> {
    // Decode the server's public key from base64
    let pk_bytes = base64::decode(server_public_key)
        .context("Failed to decode server public key")?;
    
    let public_key = sodiumoxide::crypto::box_::PublicKey::from_slice(&pk_bytes)
        .context("Invalid server public key")?;
    
    // Seal the DEK using the server's public key
    let sealed = sealedbox::seal(dek, &public_key);
    
    // Return base64 encoded sealed box
    Ok(base64::encode(&sealed))
}

/// Unwrap (unseal) the DEK using libsodium sealed box with server's key pair
pub fn unwrap_dek(
    wrapped_dek: &str,
    server_public_key: &str,
    server_private_key: &str,
) -> Result<[u8; KEY_SIZE]> {
    // Decode keys
    let pk_bytes = base64::decode(server_public_key)
        .context("Failed to decode server public key")?;
    let sk_bytes = base64::decode(server_private_key)
        .context("Failed to decode server private key")?;
    
    let public_key = sodiumoxide::crypto::box_::PublicKey::from_slice(&pk_bytes)
        .context("Invalid server public key")?;
    let secret_key = sodiumoxide::crypto::box_::SecretKey::from_slice(&sk_bytes)
        .context("Invalid server private key")?;
    
    // Decode wrapped DEK
    let sealed = base64::decode(wrapped_dek)
        .context("Failed to decode wrapped DEK")?;
    
    // Unseal the DEK
    let dek_vec = sealedbox::open(&sealed, &public_key, &secret_key)
        .map_err(|_| anyhow::anyhow!("Failed to unseal DEK"))?;
    
    if dek_vec.len() != KEY_SIZE {
        return Err(anyhow::anyhow!("Invalid DEK size"));
    }
    
    let mut dek = [0u8; KEY_SIZE];
    dek.copy_from_slice(&dek_vec);
    Ok(dek)
}

/// Encrypt a file using XChaCha20-Poly1305
pub fn encrypt_file(
    input_path: &str,
    output_path: &str,
    server_public_key: &str,
) -> Result<EncryptionResult> {
    // Initialize sodiumoxide
    sodiumoxide::init().map_err(|_| anyhow::anyhow!("Failed to initialize sodiumoxide"))?;
    
    // Generate random DEK and nonce
    let dek = generate_dek();
    let nonce_bytes = generate_nonce();
    
    // Create cipher
    let cipher = XChaCha20Poly1305::new(&dek.into());
    let nonce = XNonce::from_slice(&nonce_bytes);
    
    // Read input file
    let mut input_file = File::open(input_path)
        .context("Failed to open input file")?;
    let mut plaintext = Vec::new();
    input_file.read_to_end(&mut plaintext)
        .context("Failed to read input file")?;
    
    // Encrypt the data
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_ref())
        .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;
    
    // Write encrypted data to output file
    let mut output_file = File::create(output_path)
        .context("Failed to create output file")?;
    output_file.write_all(&ciphertext)
        .context("Failed to write encrypted file")?;
    
    // Wrap the DEK with server's public key
    let wrapped_dek = wrap_dek(&dek, server_public_key)?;
    
    // Get original filename
    let original_filename = Path::new(input_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    
    Ok(EncryptionResult {
        encrypted_file_path: output_path.to_string(),
        wrapped_dek,
        nonce: base64::encode(&nonce_bytes),
        file_size: ciphertext.len() as u64,
        original_filename,
    })
}

/// Decrypt a file using XChaCha20-Poly1305
pub fn decrypt_file(
    params: DecryptionParams,
    output_path: &str,
    server_public_key: &str,
) -> Result<String> {
    // Initialize sodiumoxide
    sodiumoxide::init().map_err(|_| anyhow::anyhow!("Failed to initialize sodiumoxide"))?;
    
    // Unwrap the DEK
    let dek = unwrap_dek(&params.wrapped_dek, server_public_key, &params.server_private_key)?;
    
    // Decode nonce
    let nonce_bytes = base64::decode(&params.nonce)
        .context("Failed to decode nonce")?;
    
    if nonce_bytes.len() != NONCE_SIZE {
        return Err(anyhow::anyhow!("Invalid nonce size"));
    }
    
    // Create cipher
    let cipher = XChaCha20Poly1305::new(&dek.into());
    let nonce = XNonce::from_slice(&nonce_bytes);
    
    // Read encrypted file
    let mut input_file = File::open(&params.encrypted_file_path)
        .context("Failed to open encrypted file")?;
    let mut ciphertext = Vec::new();
    input_file.read_to_end(&mut ciphertext)
        .context("Failed to read encrypted file")?;
    
    // Decrypt the data
    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;
    
    // Write decrypted data to output file
    let mut output_file = File::create(output_path)
        .context("Failed to create output file")?;
    output_file.write_all(&plaintext)
        .context("Failed to write decrypted file")?;
    
    Ok(output_path.to_string())
}

/// Generate a new libsodium keypair for the server
pub fn generate_server_keypair() -> Result<(String, String)> {
    sodiumoxide::init().map_err(|_| anyhow::anyhow!("Failed to initialize sodiumoxide"))?;
    
    let (pk, sk) = sodiumoxide::crypto::box_::gen_keypair();
    
    Ok((
        base64::encode(pk.as_ref()),
        base64::encode(sk.as_ref()),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_encryption_decryption() {
        // Create temp directory
        let temp_dir = TempDir::new().unwrap();
        
        // Generate server keypair
        let (public_key, private_key) = generate_server_keypair().unwrap();
        
        // Create test file
        let test_content = b"Hello, this is a test file!";
        let input_path = temp_dir.path().join("test.txt");
        let encrypted_path = temp_dir.path().join("test.enc");
        let decrypted_path = temp_dir.path().join("test_dec.txt");
        
        fs::write(&input_path, test_content).unwrap();
        
        // Encrypt
        let result = encrypt_file(
            input_path.to_str().unwrap(),
            encrypted_path.to_str().unwrap(),
            &public_key,
        ).unwrap();
        
        // Decrypt
        let params = DecryptionParams {
            encrypted_file_path: result.encrypted_file_path,
            wrapped_dek: result.wrapped_dek,
            nonce: result.nonce,
            server_private_key: private_key,
        };
        
        decrypt_file(params, decrypted_path.to_str().unwrap(), &public_key).unwrap();
        
        // Verify
        let decrypted_content = fs::read(&decrypted_path).unwrap();
        assert_eq!(test_content, decrypted_content.as_slice());
    }
}
