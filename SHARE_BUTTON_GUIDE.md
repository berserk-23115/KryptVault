# Share Button - User Guide

## How to Share Files

The Share button is now available in the right sidebar when you select a file in the dashboard.

### Setup (First Time Only)

1. **Generate Encryption Keys**
   - On first use, you'll see a dialog to set up encryption
   - Click "Generate Encryption Keys"
   - Your private keys will be stored securely on your device
   - Public keys will be registered with the server

### Sharing a File

1. **Select a file** from your file list
2. **Click "Share File"** in the right sidebar
3. **Search for user** by email address
4. **Click "Share"** next to the user you want to share with

The file will be securely shared - the recipient can decrypt it with their private key!

### Managing Access

1. Click the **"Manage Access"** tab in the share dialog
2. See who has access to the file
3. Click the trash icon to **revoke access** from a user

### Important Notes

- ✅ Files are **never re-encrypted** when shared
- ✅ Only encryption keys are shared (very fast!)
- ✅ **Instant revocation** - remove access anytime
- ✅ **Zero-knowledge** - server never sees your private keys
- ⚠️ Recipient must have encryption set up to receive files
- ⚠️ Private keys stored in localStorage (production should use OS keychain)

## Technical Details

### What Happens When You Share:

1. Your wrapped DEK (Data Encryption Key) is unwrapped with your private key
2. The DEK is re-wrapped with the recipient's public key (sealed box)
3. The wrapped DEK is stored in the `file_key` table on the server
4. Recipient can now download and decrypt the file

### Security Features:

- **X25519** sealed boxes for key wrapping
- **Ed25519** for digital signatures (future use)
- **XChaCha20-Poly1305** for file encryption
- **libsodium** crypto library

### Database Schema:

```sql
-- Controls who can access which files
file_key (
  id,
  file_id,
  recipient_user_id,
  wrapped_dek,  -- DEK wrapped with recipient's public key
  shared_by,
  created_at
)
```

## Troubleshooting

### "Please set up encryption first"
→ You haven't generated your keypairs yet. The setup dialog will appear automatically.

### "User hasn't set up encryption yet"
→ The recipient needs to log in and generate their encryption keys first.

### "Access denied" on download
→ The file hasn't been shared with you, or your access was revoked.

### Share button is disabled
→ This file uses the legacy format and cannot be shared. Re-upload the file to enable sharing.

## API Endpoints Used

- `POST /api/users/keypair` - Register public keys
- `GET /api/users/:userId/public-key` - Get recipient's key
- `GET /api/users/search` - Search users by email
- `POST /api/sharing/share` - Share file
- `DELETE /api/sharing/revoke` - Revoke access
- `GET /api/sharing/:fileId/access-list` - View who has access

See `SHARING_GUIDE.md` for complete API documentation.
