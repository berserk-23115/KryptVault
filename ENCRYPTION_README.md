# KryptVault - Client-Side Encrypted File Storage

End-to-end encrypted file storage system built with Tauri, Rust, and TypeScript.

## 🔒 Security Architecture

### Encryption Flow

1. **File Encryption (Client-Side in Tauri/Rust)**
   - Generate random 256-bit DEK (Data Encryption Key) for each file
   - Generate random 192-bit nonce for XChaCha20-Poly1305
   - Encrypt file using XChaCha20-Poly1305 AEAD with DEK
   - Wrap DEK using libsodium sealed box with server's public key
   - Only ciphertext is uploaded to S3

2. **Upload Flow**
   ```
   Client (Tauri)                   Server (Node.js)                 S3 (MinIO)
        |                                 |                             |
        |--1. Request Upload Init-------->|                             |
        |<--2. Presigned URL + Public Key-|                             |
        |                                 |                             |
        |--3. Encrypt File (XChaCha20)----|                             |
        |                                 |                             |
        |--4. Upload Ciphertext-------------------------->|             |
        |                                 |               |             |
        |--5. Store Metadata (wrapped DEK)-->|            |             |
        |<--6. Success--------------------|               |             |
   ```

3. **Download & Decryption Flow**
   ```
   Client (Tauri)                   Server (Node.js)                 S3 (MinIO)
        |                                 |                             |
        |--1. Request Download----------->|                             |
        |<--2. Presigned URL + Metadata---|                             |
        |                                 |                             |
        |--3. Download Ciphertext<------------------------|             |
        |                                 |               |             |
        |--4. Unwrap DEK (sealed box)-----|                             |
        |                                 |                             |
        |--5. Decrypt File (XChaCha20)----|                             |
        |                                 |                             |
        |--6. Save Plaintext--------------|                             |
   ```

## 🛠️ Technology Stack

### Client (Tauri/Rust)
- **chacha20poly1305**: XChaCha20-Poly1305 AEAD encryption
- **sodiumoxide**: libsodium bindings for sealed boxes
- **reqwest**: HTTP client for S3 uploads
- **rand**: Cryptographically secure random number generation

### Server (Node.js/Hono)
- **@aws-sdk/client-s3**: S3 operations and presigned URLs
- **libsodium-wrappers**: Keypair generation
- **drizzle-orm**: Database ORM
- **better-auth**: Authentication
- **Hono**: Web framework

### Storage
- **PostgreSQL**: Metadata storage (wrapped DEKs, file info)
- **MinIO/S3**: Encrypted file storage

## 📦 Installation

### Prerequisites
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install pnpm
npm install -g pnpm

# Install libsodium (required for Rust sodiumoxide)
# Ubuntu/Debian:
sudo apt-get install libsodium-dev
# macOS:
brew install libsodium
# Arch Linux:
sudo pacman -S libsodium
```

### Setup

1. **Install dependencies**
```bash
pnpm install
```

2. **Setup environment variables**
```bash
# Backend (.env in apps/server)
DATABASE_URL=postgresql://user:password@localhost:5432/kryptvault
CORS_ORIGIN=http://localhost:1420

# S3/MinIO Configuration
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin123
AWS_REGION=us-east-1
AWS_S3_ENDPOINT=http://localhost:9200
AWS_S3_BUCKET=krypt-vault-files

# Server keypair (generated on first run or set manually)
# SERVER_PUBLIC_KEY=<base64-encoded-public-key>
# SERVER_PRIVATE_KEY=<base64-encoded-private-key>
```

3. **Start MinIO (S3-compatible storage)**
```bash
# Using Docker Compose
cd packages/db
docker-compose up -d

# Or standalone MinIO
docker run -p 9200:9000 -p 9201:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin123 \
  minio/minio server /data --console-address ":9001"
```

4. **Create S3 bucket**
```bash
# Install MinIO client
brew install minio/stable/mc  # macOS
# or download from https://min.io/download

# Configure MinIO client
mc alias set local http://localhost:9200 minioadmin minioadmin123

# Create bucket
mc mb local/krypt-vault-files

# Set public policy (optional, for presigned URLs)
mc anonymous set download local/krypt-vault-files
```

5. **Run database migrations**
```bash
cd packages/db
pnpm drizzle-kit push
```

6. **Start development servers**
```bash
# Terminal 1: Backend server
cd apps/server
pnpm dev

# Terminal 2: Tauri app
cd apps/web
pnpm tauri dev
```

## 🚀 Usage

### Generate Server Keypair (First Time Setup)

```typescript
import { generateKeypair } from "@/lib/tauri-crypto";

const [publicKey, privateKey] = await generateKeypair();
console.log("Public Key:", publicKey);
console.log("Private Key:", privateKey);

// Store these in your environment variables
```

### Upload a File

```typescript
import { filesApi } from "@/lib/files-api";
import { encryptAndUploadFile } from "@/lib/tauri-crypto";

// Set user ID from your auth context
filesApi.setUserId(currentUser.id);

// 1. Initialize upload
const initResponse = await filesApi.initUpload(
  file.name,
  file.size,
  file.type
);

// 2. Encrypt and upload via Tauri
const uploadResponse = await encryptAndUploadFile({
  file_path: localFilePath,
  server_public_key: initResponse.serverPublicKey,
  presigned_url: initResponse.presignedUrl,
  file_key: initResponse.s3Key,
});

// 3. Complete upload on server
await filesApi.completeUpload({
  fileId: initResponse.fileId,
  s3Key: uploadResponse.file_key,
  wrappedDek: uploadResponse.wrapped_dek,
  nonce: uploadResponse.nonce,
  originalFilename: uploadResponse.original_filename,
  fileSize: uploadResponse.file_size,
  mimeType: file.type,
});
```

### Download a File

```typescript
// 1. Get download info
const downloadInfo = await filesApi.getDownloadInfo(fileId);

// 2. Download and decrypt via Tauri
const outputPath = await downloadAndDecryptFile({
  download_url: downloadInfo.downloadUrl,
  wrapped_dek: downloadInfo.wrappedDek,
  nonce: downloadInfo.nonce,
  server_public_key: downloadInfo.serverPublicKey,
  server_private_key: downloadInfo.serverPrivateKey,
  output_path: "/path/to/save/file",
});
```

### List Files

```typescript
const files = await filesApi.listFiles();
console.log(files);
```

## 🔐 Security Considerations

### Current Implementation

✅ **Secure:**
- Client-side encryption using XChaCha20-Poly1305 AEAD
- Per-file random DEK (never reused)
- DEK wrapped using libsodium sealed boxes
- Only ciphertext stored in S3
- Authenticated encryption (prevents tampering)

⚠️ **Production Improvements Needed:**

1. **Server Private Key Handling**
   - Current: Server sends private key to client for decryption
   - **Fix**: Implement server-side DEK unwrapping
   ```typescript
   // Server should unwrap DEK and re-encrypt for client
   const dek = unsealDek(wrappedDek, serverPrivateKey);
   const clientWrappedDek = sealDek(dek, clientPublicKey);
   ```

2. **Key Management**
   - Store server keypair in HSM or key management service (AWS KMS, Vault)
   - Rotate keys periodically
   - Implement key versioning

3. **Access Control**
   - Implement proper session validation
   - Add rate limiting
   - Audit logging for all operations

4. **File Sharing**
   - Implement per-user keypairs for secure sharing
   - Re-encrypt DEK for each recipient

## 📁 Project Structure

```
krypt-vault/
├── apps/
│   ├── server/                 # Backend API (Hono)
│   │   └── src/
│   │       ├── index.ts
│   │       └── routes/
│   │           └── files.ts    # File upload/download endpoints
│   └── web/                    # Tauri frontend
│       ├── src/
│       │   ├── lib/
│       │   │   ├── files-api.ts      # Server API client
│       │   │   └── tauri-crypto.ts   # Tauri crypto commands
│       │   └── components/
│       │       └── FileUploadDemo.tsx
│       └── src-tauri/
│           └── src/
│               ├── crypto.rs   # Encryption/decryption logic
│               ├── s3.rs       # S3 upload logic
│               ├── commands.rs # Tauri commands
│               └── lib.rs      # Main entry point
└── packages/
    └── db/
        └── src/
            └── schema/
                └── files.ts    # Database schema
```

## 🧪 Testing

### Test Encryption/Decryption

```rust
// In Rust (src-tauri/src/crypto.rs)
cargo test
```

### Test Upload Flow

```typescript
// Use the FileUploadDemo component
// Or test manually:
import { encryptFileOnly } from "@/lib/tauri-crypto";

const result = await encryptFileOnly(
  "/path/to/input.txt",
  "/path/to/output.enc",
  serverPublicKey
);

console.log("Encrypted:", result);
```

## 🐛 Troubleshooting

### libsodium build errors
```bash
# Ensure libsodium-dev is installed
sudo apt-get install libsodium-dev pkg-config
```

### S3 connection errors
```bash
# Check MinIO is running
curl http://localhost:9200

# Check bucket exists
mc ls local/
```

### Database connection errors
```bash
# Check PostgreSQL is running
psql $DATABASE_URL -c "SELECT 1"
```

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please ensure:
- Encryption logic changes are reviewed carefully
- Add tests for security-critical code
- Follow existing code style

## 📚 References

- [XChaCha20-Poly1305 Specification](https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha)
- [libsodium Documentation](https://doc.libsodium.org/)
- [Tauri Documentation](https://tauri.app/)
- [AWS S3 Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
