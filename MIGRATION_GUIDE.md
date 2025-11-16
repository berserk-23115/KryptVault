# Database Migration Summary

## New Tables to Create

After running your database migrations, you should have these new tables:

### 1. `user_keypair`
Stores users' public keys for E2EE sharing (private keys NEVER stored on server)

```sql
CREATE TABLE user_keypair (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE CASCADE,
  x25519_public_key TEXT NOT NULL,
  ed25519_public_key TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 2. `file_key`
Controls who can access which files (the core of sharing)

```sql
CREATE TABLE file_key (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  recipient_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  wrapped_dek TEXT NOT NULL,
  shared_by TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 3. `folder`
Organizational folders for files

```sql
CREATE TABLE folder (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_folder_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 4. `folder_key`
Controls who can access which folders

```sql
CREATE TABLE folder_key (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL REFERENCES folder(id) ON DELETE CASCADE,
  recipient_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  wrapped_folder_key TEXT NOT NULL,
  shared_by TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 5. `file_folder_key`
Links files to folders with wrapped keys

```sql
CREATE TABLE file_folder_key (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  folder_id TEXT NOT NULL REFERENCES folder(id) ON DELETE CASCADE,
  wrapped_dek TEXT NOT NULL,
  wrapping_nonce TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Modified Tables

### `file` table changes:
- Added `folder_id TEXT` (nullable, for folder assignment)
- Changed `wrapped_dek` to nullable (deprecated, use `file_key` table instead)

## Migration Command

Run this in the `/packages/db` directory:

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

Or if using drizzle studio:

```bash
pnpm drizzle-kit push
```

## Indexes to Consider (Optional but Recommended)

For better query performance, consider adding these indexes:

```sql
CREATE INDEX idx_file_key_recipient ON file_key(recipient_user_id);
CREATE INDEX idx_file_key_file ON file_key(file_id);
CREATE INDEX idx_folder_key_recipient ON folder_key(recipient_user_id);
CREATE INDEX idx_folder_key_folder ON folder_key(folder_id);
CREATE INDEX idx_user_keypair_user ON user_keypair(user_id);
```

## Data Migration (If You Have Existing Files)

If you have existing files in the `file` table with `wrapped_dek`, you need to migrate them:

```sql
-- For each existing file, create a file_key entry for the owner
INSERT INTO file_key (id, file_id, recipient_user_id, wrapped_dek, shared_by, created_at)
SELECT 
  gen_random_uuid()::text,
  id,
  user_id,
  wrapped_dek,
  user_id,
  created_at
FROM file
WHERE wrapped_dek IS NOT NULL;

-- Optional: Clear the deprecated wrapped_dek column
-- UPDATE file SET wrapped_dek = NULL;
```

## Verification

After migration, verify the tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_keypair', 'file_key', 'folder', 'folder_key', 'file_folder_key');
```

You should see all 5 new tables.
