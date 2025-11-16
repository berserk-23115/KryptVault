# Quick Reference: File Sharing API

## 🔑 User Keypair Setup (First Time)

```typescript
import { generateUserKeypair } from '@/lib/tauri-crypto';
import { registerKeypair } from '@/lib/sharing-api';

// 1. Generate keypair on client
const keypair = await generateUserKeypair();

// 2. Store private keys securely (OS keychain recommended)
storeInKeychain('x25519_private', keypair.x25519_private_key);
storeInKeychain('ed25519_private', keypair.ed25519_private_key);

// 3. Register public keys with server
await registerKeypair(
  keypair.x25519_public_key,
  keypair.ed25519_public_key
);
```

## 📤 Share a File

```typescript
import { shareFileKey } from '@/lib/tauri-crypto';
import { shareFile, getUserPublicKey } from '@/lib/sharing-api';

// 1. Get recipient's public key
const recipient = await getUserPublicKey(recipientUserId);

// 2. Get your wrapped DEK from file
const myFile = files.find(f => f.fileId === fileId);

// 3. Get your private key from keychain
const myPrivateKey = getFromKeychain('x25519_private');
const myPublicKey = await getMyKeypair().then(k => k.x25519PublicKey);

// 4. Re-wrap DEK for recipient
const wrappedForRecipient = await shareFileKey(
  myFile.wrappedDek,
  myPublicKey,
  myPrivateKey,
  recipient.x25519PublicKey
);

// 5. Send to server
await shareFile({
  fileId,
  recipientUserId,
  wrappedDek: wrappedForRecipient
});
```

## 🗑️ Revoke Access

```typescript
import { revokeAccess } from '@/lib/sharing-api';

await revokeAccess(fileId, recipientUserId);
// Done! User can no longer download file
```

## 📁 Create & Share Folder

```typescript
import { generateFolderKey, shareFileKey } from '@/lib/tauri-crypto';
import { createFolder, shareFolder } from '@/lib/folders-api';

// 1. Generate folder key
const folderKeyB64 = await generateFolderKey();

// 2. Wrap for yourself
const myKeys = getMyKeysFromKeychain();
const wrappedForMe = await shareFileKey(
  folderKeyB64,
  myKeys.publicKey,
  myKeys.privateKey,
  myKeys.publicKey
);

// 3. Create folder
const { folderId } = await createFolder({
  name: 'My Shared Folder',
  wrappedFolderKey: wrappedForMe
});

// 4. Share with others
const recipient = await getUserPublicKey(recipientUserId);
const wrappedForRecipient = await shareFileKey(
  folderKeyB64,
  myKeys.publicKey,
  myKeys.privateKey,
  recipient.x25519PublicKey
);

await shareFolder({
  folderId,
  recipientUserId,
  wrappedFolderKey: wrappedForRecipient
});
```

## 📥 Download Shared File

```typescript
import { unwrapSharedDek } from '@/lib/tauri-crypto';
import { downloadAndDecryptFile } from '@/lib/tauri-crypto';

// 1. Get download info from server
const response = await fetch(`/api/files/${fileId}/download`, {
  method: 'POST',
  credentials: 'include'
});
const { downloadUrl, wrappedDek, nonce, originalFilename } = await response.json();

// 2. Get your keys
const myKeys = getMyKeysFromKeychain();

// 3. Download and decrypt (Tauri handles it all)
const savedPath = await downloadAndDecryptFile({
  download_url: downloadUrl,
  wrapped_dek: wrappedDek,
  nonce: nonce,
  server_public_key: myKeys.publicKey,
  server_private_key: myKeys.privateKey,
  output_path: `~/Downloads/${originalFilename}`
});

console.log('File saved to:', savedPath);
```

## 📋 List Shared Files

```typescript
import { getSharedWithMe } from '@/lib/sharing-api';

const sharedFiles = await getSharedWithMe();

sharedFiles.forEach(file => {
  console.log(`${file.originalFilename} shared by ${file.sharedBy}`);
});
```

## 👥 View Who Has Access

```typescript
import { getFileAccessList } from '@/lib/sharing-api';

const { owner, sharedWith } = await getFileAccessList(fileId);

console.log('Owner:', owner.name);
console.log('Shared with:');
sharedWith.forEach(user => {
  console.log(`- ${user.name} (${user.email}) shared on ${user.sharedAt}`);
});
```

## 🔍 Search Users

```typescript
import { searchUsers } from '@/lib/sharing-api';

const users = await searchUsers('alice@example.com');

if (users.length > 0) {
  const user = users[0];
  if (user.hasKeypair) {
    // User has encryption set up, can share with them
    console.log('Can share with:', user.name);
  }
}
```

## 📊 Database Queries (Server Side)

### Check if user has access to file
```typescript
const [access] = await db
  .select()
  .from(fileKey)
  .where(and(
    eq(fileKey.fileId, fileId),
    eq(fileKey.recipientUserId, userId)
  ))
  .limit(1);

const hasAccess = !!access;
```

### Get all users with access to file
```typescript
const users = await db
  .select({
    userId: user.id,
    name: user.name,
    email: user.email
  })
  .from(fileKey)
  .innerJoin(user, eq(fileKey.recipientUserId, user.id))
  .where(eq(fileKey.fileId, fileId));
```

### Get all files user has access to
```typescript
const files = await db
  .select({
    fileId: file.id,
    filename: file.originalFilename,
    wrappedDek: fileKey.wrappedDek
  })
  .from(fileKey)
  .innerJoin(file, eq(fileKey.fileId, file.id))
  .where(eq(fileKey.recipientUserId, userId));
```

## 🛡️ Security Checklist

- [ ] Private keys stored in OS keychain (NOT localStorage)
- [ ] Public keys sent to server on first login
- [ ] All file encryption happens client-side
- [ ] DEKs wrapped with recipient's public key before sharing
- [ ] Server validates file_key entries before allowing download
- [ ] Revocation immediately removes file_key entry
- [ ] Audit log for share/revoke operations
- [ ] Rate limiting on sharing endpoints
- [ ] Input validation on all API endpoints

## 🐛 Common Issues & Solutions

### "Recipient not found or hasn't set up encryption"
→ User hasn't generated/registered their keypair yet

### "Access denied" on download
→ Check file_key table has entry for user + file

### "Failed to unseal DEK"
→ Wrong private key being used, or wrapped DEK corrupted

### "File not found" but user is owner
→ Check file_key table has entry where recipient_user_id = owner

## 📞 API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/users/keypair` | POST | Register public keys |
| `/api/users/keypair` | GET | Get own keys |
| `/api/users/:id/public-key` | GET | Get user's key |
| `/api/sharing/share` | POST | Share file |
| `/api/sharing/revoke` | DELETE | Revoke access |
| `/api/sharing/shared-with-me` | GET | Files shared with me |
| `/api/folders` | POST | Create folder |
| `/api/folders/:id/share` | POST | Share folder |
| `/api/files/:id/download` | POST | Download file |

See `SHARING_GUIDE.md` for complete details.
