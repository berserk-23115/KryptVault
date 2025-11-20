const API_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

/**
 * Get headers with authorization token
 */
function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  
  // Add bearer token if available
  const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  return headers;
}

export interface ShareFileRequest {
  fileId: string;
  recipientUserId: string;
  wrappedDek: string;
}

export interface ShareBulkRequest {
  fileId: string;
  recipients: {
    userId: string;
    wrappedDek: string;
  }[];
}

export interface SharedFile {
  fileId: string;
  originalFilename: string;
  mimeType: string | null;
  fileSize: number;
  s3Key: string;
  s3Bucket: string;
  nonce: string;
  wrappedDek: string;
  sharedBy: string;
  sharedByEmail: string;
  sharedAt: Date;
}

export interface ShareRecord {
  fileId: string;
  originalFilename: string;
  recipientUserId: string;
  recipientName: string;
  recipientEmail: string;
  sharedAt: Date;
}

export interface SharedByMeFile {
  fileId: string;
  originalFilename: string;
  recipients: Array<{
    userId: string;
    name: string;
    email: string;
    sharedAt: Date;
  }>;
}

export interface UserPublicKey {
  userId: string;
  x25519PublicKey: string;
  userName: string;
  userEmail: string;
}

export interface AccessListUser {
  userId: string;
  name: string;
  email: string;
  sharedBy?: string;
  sharedAt?: Date;
}

export interface AccessList {
  owner: AccessListUser;
  sharedWith: AccessListUser[];
}

/**
 * Share a file with another user
 */
export async function shareFile(request: ShareFileRequest): Promise<void> {
  const response = await fetch(`${API_URL}/api/sharing/share`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to share file");
  }
}

/**
 * Share a file with multiple users at once
 */
export async function shareBulk(request: ShareBulkRequest): Promise<{ sharedCount: number }> {
  const response = await fetch(`${API_URL}/api/sharing/share-bulk`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to share file");
  }

  return response.json();
}

/**
 * Revoke a user's access to a file
 */
export async function revokeAccess(fileId: string, recipientUserId: string): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null;
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(
    `${API_URL}/api/sharing/revoke?fileId=${fileId}&recipientUserId=${recipientUserId}`,
    {
      method: "DELETE",
      headers,
      credentials: "include",
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to revoke access");
  }
}

/**
 * List files shared with the current user
 */
export async function getSharedWithMe(): Promise<SharedFile[]> {
  const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null;
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}/api/sharing/shared-with-me`, {
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch shared files");
  }

  const data = await response.json();
  return data.files;
}

/**
 * List files the current user has shared with others
 */
export async function getSharedByMe(): Promise<SharedByMeFile[]> {
  const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null;
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}/api/sharing/shared-by-me`, {
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch shared files");
  }

  const data = await response.json();
  return data.files;
}

/**
 * Get list of users with access to a file
 */
export async function getFileAccessList(fileId: string): Promise<AccessList> {
  const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null;
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}/api/sharing/${fileId}/access-list`, {
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get access list");
  }

  return response.json();
}

/**
 * Get another user's public key for sharing
 */
export async function getUserPublicKey(userId: string): Promise<UserPublicKey> {
  const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null;
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}/api/users/${userId}/public-key`, {
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get user public key");
  }

  return response.json();
}

/**
 * Search users by email
 */
export async function searchUsers(email: string): Promise<any[]> {
  const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null;
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}/api/users/search?email=${encodeURIComponent(email)}`, {
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to search users");
  }

  const data = await response.json();
  return data.users;
}

/**
 * Register user's public keypair
 */
export async function registerKeypair(x25519PublicKey: string, ed25519PublicKey: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/users/keypair`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({
      x25519PublicKey,
      ed25519PublicKey,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to register keypair");
  }
}

/**
 * Get current user's public keypair
 */
export async function getMyKeypair(): Promise<{ x25519PublicKey: string; ed25519PublicKey: string }> {
  const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null;
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}/api/users/keypair`, {
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get keypair");
  }

  return response.json();
}

// ================== Folder Sharing Functions ==================

export interface ShareFolderRequest {
  recipientUserId: string;
  wrappedFolderKey: string;
}

/**
 * Share a folder with another user
 */
export async function shareFolder(folderId: string, request: ShareFolderRequest): Promise<void> {
  const response = await fetch(`${API_URL}/api/folders/${folderId}/share`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to share folder");
  }
}

/**
 * Get list of users with access to a folder
 */
export async function getFolderAccessList(folderId: string): Promise<AccessList> {
  const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null;
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}/api/folders/${folderId}/access-list`, {
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get folder access list");
  }

  return response.json();
}

/**
 * Revoke a user's access to a folder
 */
export async function revokeFolderAccess(folderId: string, recipientUserId: string): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null;
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(
    `${API_URL}/api/folders/${folderId}/revoke?recipientUserId=${recipientUserId}`,
    {
      method: "DELETE",
      headers,
      credentials: "include",
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to revoke folder access");
  }
}

