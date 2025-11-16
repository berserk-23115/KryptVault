# Secure File Sharing System - Complete Guide

This document explains the end-to-end encrypted (E2EE) file sharing system implementation in KryptVault.

## 🔑 Core Principle

**Sharing = securely delivering the DEK (file key) to another user.**

- The encrypted file stays in S3 **untouched**
- Only the file key (DEK) is shared
- No re-encryption of files
- Simple, efficient, secure

## 📦 Architecture Overview

### 1. User Keypairs

Every user has two keypairs stored locally:

- **X25519 keypair** (Curve25519): For encryption via sealed boxes
  - Public key → stored on server
  - Private key → stored ONLY in client (Tauri app, OS keychain recommended)
  
- **Ed25519 keypair**: For digital signatures and identity
  - Public key → stored on server
  - Private key → stored ONLY in client

### 2. Database Schema

```sql
-- User public keys (private keys NEVER stored on server)
user_keypair {
  id, user_id, x25519_public_key, ed25519_public_key, created_at, updated_at
}

-- Files (encrypted, stored in S3)
file {
  id, user_id, folder_id, original_filename, mime_type, file_size,
  s3_key, s3_bucket, nonce, description, tags, created_at, updated_at
}

-- File access control (who can decrypt which files)
file_key {
  id, file_id, recipient_user_id, wrapped_dek, shared_by, created_at
}

-- Folders for organization
folder {
  id, owner_id, name, description, parent_folder_id, created_at, updated_at
}

-- Folder access control
folder_key {
  id, folder_id, recipient_user_id, wrapped_folder_key, shared_by, created_at
}

-- Files encrypted with folder keys (for efficient folder sharing)
file_folder_key {
  id, file_id, folder_id, wrapped_dek, wrapping_nonce, created_at
}
```

## 🔄 File Lifecycle Flows

### Upload Flow (Owner Creates File)

1. **Client Side:**
   - Generate random DEK (256-bit file key)
   - Encrypt file with DEK using XChaCha20-Poly1305
   - Generate nonce for encryption
   - Wrap DEK with **owner's X25519 public key** (sealed box)
   - Upload encrypted file to S3

2. **Server Side:**
   - Store file metadata in `file` table
   - Store wrapped DEK in `file_key` table with `recipient_user_id = owner_id`
   - Owner now has access to their own file

**Key Point:** Even the file owner stores their DEK wrapped in a sealed box, maintaining zero-knowledge encryption.

### Share Flow (Owner Shares with User B)

1. **Client requests to share:**
   - Fetch recipient's (User B) X25519 public key from server
   - Fetch own wrapped DEK from server

2. **Client unwraps and re-wraps:**
   ```
   DEK = unseal(wrapped_dek_for_owner, owner_private_key, owner_public_key)
   wrapped_dek_for_B = seal(DEK, recipient_B_public_key)
   ```

3. **Client sends to server:**
   - `fileId`, `recipientUserId`, `wrappedDek`

4. **Server stores:**
   - Insert into `file_key` table:
     ```
     {
       file_id: fileId,
       recipient_user_id: B's user ID,
       wrapped_dek: wrapped_dek_for_B,
       shared_by: owner's user ID
     }
     ```

**Result:** User B can now decrypt the file using their private key.

### Download Flow (Recipient Downloads Shared File)

1. **Client requests download:**
   - Request file metadata and presigned S3 URL

2. **Server checks access:**
   - Query `file_key` table for entry with `file_id` and `recipient_user_id`
   - If exists, return:
     - Presigned S3 download URL
     - User-specific `wrapped_dek`
     - File `nonce`
     - Metadata

3. **Client decrypts:**
   ```
   DEK = unseal(wrapped_dek, user_private_key, user_public_key)
   plaintext = decrypt(encrypted_file, DEK, nonce)
   ```

### Revoke Flow (Remove Access)

**Server Side:**
```sql
DELETE FROM file_key 
WHERE file_id = ? AND recipient_user_id = ?
```

**Result:** User can no longer download or decrypt the file in the future.

**Important:** If they already downloaded it, they can't be prevented from keeping it (this is true for any E2EE system).

## 📁 Folder Sharing System

For efficiency when sharing multiple files, use folder-based encryption:

### How It Works

1. **Create Folder:**
   - Generate random `folder_key` (256-bit)
   - Wrap `folder_key` with owner's public key
   - Store in `folder` and `folder_key` tables

2. **Add Files to Folder:**
   - Encrypt file with DEK as usual
   - **Wrap DEK with folder_key** (symmetric encryption, not sealed box)
   - Store in `file_folder_key` table

3. **Share Folder with User B:**
   - Unwrap `folder_key` using owner's private key
   - Re-wrap `folder_key` with User B's public key
   - Store in `folder_key` table
   - User B now has access to ALL files in the folder

4. **Access File in Shared Folder:**
   ```
   folder_key = unseal(wrapped_folder_key, user_private_key, user_public_key)
   DEK = decrypt(wrapped_dek_in_folder, folder_key, wrapping_nonce)
   plaintext = decrypt(encrypted_file, DEK, file_nonce)
   ```

**Benefits:**
- Share 1000 files by sharing 1 folder key
- Add/remove files from folder without re-sharing
- Revoke folder access removes access to all files at once

## 🛠️ API Endpoints

### User Keypair Management
- `POST /api/users/keypair` - Register public keys
- `GET /api/users/keypair` - Get own public keys
- `GET /api/users/:userId/public-key` - Get user's public key for sharing
- `GET /api/users/search?email=` - Search users by email

### File Sharing
- `POST /api/sharing/share` - Share file with one user
- `POST /api/sharing/share-bulk` - Share file with multiple users
- `DELETE /api/sharing/revoke` - Revoke access
- `GET /api/sharing/shared-with-me` - List files shared with me
- `GET /api/sharing/shared-by-me` - List files I've shared
- `GET /api/sharing/:fileId/access-list` - See who has access

### Folder Management
- `POST /api/folders` - Create folder
- `GET /api/folders` - List folders (owned + shared)
- `GET /api/folders/:folderId` - Get folder details & files
- `POST /api/folders/:folderId/share` - Share folder
- `DELETE /api/folders/:folderId/revoke` - Revoke folder access
- `POST /api/folders/:folderId/files` - Add file to folder
- `DELETE /api/folders/:folderId/files/:fileId` - Remove file from folder
- `GET /api/folders/:folderId/access-list` - Get folder access list

### File Operations (Updated)
- `POST /api/files/upload/init` - Get presigned upload URL
- `POST /api/files/upload/complete` - Complete upload (stores file_key)
- `GET /api/files` - List accessible files (owned + shared)
- `POST /api/files/:fileId/download` - Download file (checks file_key table)
- `DELETE /api/files/:fileId` - Delete file

## 🔐 Tauri Commands (Client-Side Crypto)

### User Keypair
```typescript
generateUserKeypair(): Promise<UserKeypair>
```

### File Sharing
```typescript
shareFileKey(
  wrappedDek: string,
  userPublicKey: string,
  userPrivateKey: string,
  recipientPublicKey: string
): Promise<string>

unwrapSharedDek(
  wrappedDek: string,
  userPublicKey: string,
  userPrivateKey: string
): Promise<string>
```

### Folder Management
```typescript
generateFolderKey(): Promise<string>

wrapDekWithFolderKey(params: {
  dek_b64: string,
  folder_key_b64: string
}): Promise<{ wrapped_dek: string, wrapping_nonce: string }>

unwrapDekWithFolderKey(params: {
  wrapped_dek: string,
  wrapping_nonce: string,
  folder_key_b64: string
}): Promise<string>
```

## 🚀 Usage Examples

### Example 1: Share a File

```typescript
import { shareFileKey } from '@/lib/tauri-crypto';
import { shareFile, getUserPublicKey } from '@/lib/sharing-api';

async function shareMyFile(fileId: string, recipientUserId: string) {
  // 1. Get recipient's public key
  const recipient = await getUserPublicKey(recipientUserId);
  
  // 2. Get your wrapped DEK from file metadata
  const myFile = await getFileMetadata(fileId);
  
  // 3. Get your keypair from local storage
  const myKeypair = getKeypairFromStorage();
  
  // 4. Re-wrap DEK for recipient
  const wrappedDekForRecipient = await shareFileKey(
    myFile.wrappedDek,
    myKeypair.x25519_public_key,
    myKeypair.x25519_private_key,
    recipient.x25519PublicKey
  );
  
  // 5. Send to server
  await shareFile({
    fileId,
    recipientUserId,
    wrappedDek: wrappedDekForRecipient
  });
}
```

### Example 2: Create and Share a Folder

```typescript
import { generateFolderKey, shareFileKey } from '@/lib/tauri-crypto';
import { createFolder, shareFolder } from '@/lib/folders-api';

async function createSharedFolder(
  name: string,
  recipientUserIds: string[]
) {
  // 1. Generate folder key
  const folderKeyB64 = await generateFolderKey();
  
  // 2. Get your keypair
  const myKeypair = getKeypairFromStorage();
  
  // 3. Wrap folder key for yourself
  const wrappedForMe = await shareFileKey(
    folderKeyB64,
    myKeypair.x25519_public_key,
    myKeypair.x25519_private_key,
    myKeypair.x25519_public_key
  );
  
  // 4. Create folder
  const { folderId } = await createFolder({
    name,
    wrappedFolderKey: wrappedForMe
  });
  
  // 5. Share with recipients
  for (const userId of recipientUserIds) {
    const recipient = await getUserPublicKey(userId);
    const wrappedForRecipient = await shareFileKey(
      folderKeyB64,
      myKeypair.x25519_public_key,
      myKeypair.x25519_private_key,
      recipient.x25519PublicKey
    );
    
    await shareFolder({
      folderId,
      recipientUserId: userId,
      wrappedFolderKey: wrappedForRecipient
    });
  }
}
```

## 🔒 Security Considerations

### What's Protected
- ✅ File contents (E2EE with XChaCha20-Poly1305)
- ✅ File keys (sealed boxes, only recipient can open)
- ✅ Folder keys (sealed boxes, only recipients can open)
- ✅ Zero-knowledge: server cannot decrypt files
- ✅ Access control (file_key table)

### What's NOT Protected (Metadata)
- ❌ Filenames (stored in plaintext)
- ❌ File sizes (visible to server)
- ❌ Who shared with whom (visible to server)
- ❌ Folder structure (visible to server)

### Private Keys
- **MUST** be stored client-side only
- Recommended: OS keychain/keyring
  - macOS: Keychain Access
  - Windows: Credential Manager
  - Linux: Secret Service API (libsecret)
- Alternative: Encrypt with user passphrase

### Future Enhancements
1. **Encrypted Filenames:** Encrypt with user's key
2. **Padding:** Hide file sizes
3. **Decoy Traffic:** Hide access patterns
4. **Forward Secrecy:** Rotate keys periodically

## 📝 Implementation Checklist

- [x] Database schema (user_keypair, file_key, folder, folder_key, file_folder_key)
- [x] Rust crypto functions (keypair gen, wrap/unwrap, sealed boxes)
- [x] Tauri commands (keypair management, sharing, folders)
- [x] Server API routes (users, sharing, folders)
- [x] Client API functions (TypeScript)
- [ ] UI components (share dialog, folder browser, access management)
- [ ] Keychain integration for private key storage
- [ ] User onboarding flow (keypair generation)
- [ ] Testing (unit tests, integration tests)

## 🎯 Next Steps

1. **Integrate Keychain Storage:**
   - Use `tauri-plugin-keyring` or similar
   - Store private keys securely in OS keychain

2. **Build UI Components:**
   - Share file dialog with user search
   - Folder creation/management UI
   - Access control viewer (who has access)
   - Shared files browser

3. **User Onboarding:**
   - Detect if user has keypair on first login
   - Generate keypair and upload public keys
   - Backup recovery options

4. **Testing:**
   - Test share/revoke flows
   - Test folder sharing with multiple users
   - Test edge cases (revoked access, deleted users)

## 📚 References

- [libsodium documentation](https://doc.libsodium.org/)
- [XChaCha20-Poly1305](https://tools.ietf.org/html/draft-irtf-cfrg-xchacha)
- [Sealed Boxes](https://doc.libsodium.org/public-key_cryptography/sealed_boxes)
- [Curve25519](https://cr.yp.to/ecdh.html)
