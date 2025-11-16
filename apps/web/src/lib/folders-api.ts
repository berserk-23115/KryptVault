const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

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

export interface CreateFolderRequest {
  name: string;
  description?: string;
  parentFolderId?: string;
  wrappedFolderKey: string; // Folder key wrapped with owner's public key
}

export interface ShareFolderRequest {
  folderId: string;
  recipientUserId: string;
  wrappedFolderKey: string; // Folder key wrapped with recipient's public key
}

export interface AddFileToFolderRequest {
  fileId: string;
  folderId: string;
  wrappedDek: string; // File DEK wrapped with folder key
  wrappingNonce: string;
}

export interface Folder {
  folderId: string;
  name: string;
  description: string | null;
  parentFolderId: string | null;
  ownerId: string;
  ownerName: string;
  wrappedFolderKey: string;
  createdAt: Date;
}

export interface FolderFile {
  fileId: string;
  originalFilename: string;
  mimeType: string | null;
  fileSize: number;
  wrappedDek: string;
  wrappingNonce: string;
  s3Key: string;
  s3Bucket: string;
  nonce: string;
  createdAt: Date;
}

export interface FolderDetails {
  folder: {
    folderId: string;
    name: string;
    description: string | null;
    parentFolderId: string | null;
    ownerId: string;
    wrappedFolderKey: string;
  };
  files: FolderFile[];
}

/**
 * Create a new folder
 */
export async function createFolder(request: CreateFolderRequest): Promise<{ folderId: string }> {
  const response = await fetch(`${API_URL}/api/folders`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create folder");
  }

  return response.json();
}

/**
 * List user's folders (owned and shared)
 */
export async function getFolders(): Promise<Folder[]> {
  const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null;
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}/api/folders`, {
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch folders");
  }

  const data = await response.json();
  return data.folders;
}

/**
 * Get folder details and files
 */
export async function getFolderDetails(folderId: string): Promise<FolderDetails> {
  const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null;
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}/api/folders/${folderId}`, {
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get folder");
  }

  return response.json();
}

/**
 * Share a folder with another user
 */
export async function shareFolder(request: ShareFolderRequest): Promise<void> {
  const response = await fetch(`${API_URL}/api/folders/${request.folderId}/share`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({
      recipientUserId: request.recipientUserId,
      wrappedFolderKey: request.wrappedFolderKey,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to share folder");
  }
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

/**
 * Add a file to a folder
 */
export async function addFileToFolder(request: AddFileToFolderRequest): Promise<void> {
  const response = await fetch(`${API_URL}/api/folders/${request.folderId}/files`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({
      fileId: request.fileId,
      wrappedDek: request.wrappedDek,
      wrappingNonce: request.wrappingNonce,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to add file to folder");
  }
}

/**
 * Remove a file from a folder
 */
export async function removeFileFromFolder(folderId: string, fileId: string): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null;
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}/api/folders/${folderId}/files/${fileId}`, {
    method: "DELETE",
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to remove file from folder");
  }
}

/**
 * Get list of users with access to a folder
 */
export async function getFolderAccessList(folderId: string): Promise<{
  owner: { userId: string; name: string; email: string };
  sharedWith: Array<{
    userId: string;
    name: string;
    email: string;
    sharedBy: string;
    sharedAt: Date;
  }>;
}> {
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
