const API_BASE_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

export interface FileMetadata {
  id: string;
  fileId?: string; // Server returns fileId from join
  userId: string;
  originalFilename: string;
  mimeType?: string;
  fileSize: number;
  s3Key: string;
  s3Bucket: string;
  wrappedDek: string; // From file_key table
  nonce: string;
  createdAt: Date;
  updatedAt: Date;
  description?: string;
  tags?: string[];
  folderId?: string;
  isOwner?: boolean; // Whether current user owns the file
  ownerName?: string; // Name of the file owner
  ownerEmail?: string; // Email of the file owner
  deletedAt?: Date; // When file was moved to trash
  deletedBy?: string; // Who deleted it
  scheduledDeletionAt?: Date; // When to permanently delete
}

export interface UploadInitResponse {
  fileId: string;
  s3Key: string;
  presignedUrl: string;
  serverPublicKey: string;
}

export interface UploadCompleteRequest {
  fileId: string;
  s3Key: string;
  wrappedDek: string;
  nonce: string;
  originalFilename: string;
  fileSize: number;
  mimeType?: string;
  description?: string;
  tags?: string[];
}

export interface DownloadResponse {
  downloadUrl: string;
  wrappedDek: string;
  nonce: string;
  originalFilename: string;
  mimeType?: string;
}

export interface StorageUsage {
  usedBytes: number;
  quotaBytes: number;
  usedPercentage: number;
  breakdown: {
    images: number;
    videos: number;
    documents: number;
    others: number;
  };
}


class FilesApiClient {
  private baseUrl: string;
  private userId: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    // Add bearer token for authentication
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("bearer_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    // Optional: x-user-id header for development/testing
    if (this.userId) {
      headers["x-user-id"] = this.userId;
    }

    const response = await fetch(`${this.baseUrl}/api/files${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get server's public key
   */
  async getServerPublicKey(): Promise<string> {
    const response = await this.request<{ publicKey: string }>(
      "/server-public-key"
    );
    return response.publicKey;
  }

  /**
   * Initialize file upload
   */
  async initUpload(
    filename: string,
    fileSize: number,
    mimeType?: string
  ): Promise<UploadInitResponse> {
    return this.request<UploadInitResponse>("/upload/init", {
      method: "POST",
      body: JSON.stringify({ filename, fileSize, mimeType }),
    });
  }

  /**
   * Complete file upload
   */
  async completeUpload(
    data: UploadCompleteRequest
  ): Promise<{ success: boolean; fileId: string }> {
    return this.request<{ success: boolean; fileId: string }>(
      "/upload/complete",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Get file metadata
   */
  async getFile(fileId: string): Promise<FileMetadata> {
    return this.request<FileMetadata>(`/${fileId}`);
  }

  /**
   * List all files
   */
  async listFiles(): Promise<FileMetadata[]> {
    const response = await this.request<{ files: FileMetadata[] }>("/");
    return response.files;
  }

  /**
   * Get download URL and decryption metadata
   */
  async getDownloadInfo(fileId: string): Promise<DownloadResponse> {
    return this.request<DownloadResponse>(`/${fileId}/download`, {
      method: "POST",
    });
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.request(`/${fileId}`, {
      method: "DELETE",
    });
  }

  /**
   * List files in trash
   */
  async listTrash(): Promise<FileMetadata[]> {
    const response = await this.request<{ files: FileMetadata[] }>("/trash");
    return response.files;
  }

  /**
   * Restore file from trash
   */
  async restoreFile(fileId: string): Promise<void> {
    await this.request(`/${fileId}/restore`, {
      method: "POST",
    });
  }

  /**
   * Permanently delete file from trash
   */
  async permanentlyDeleteFile(fileId: string): Promise<void> {
    await this.request(`/${fileId}/permanent`, {
      method: "DELETE",
    });
  }

  /**
   * Get storage usage statistics
   */
  async getStorageUsage(): Promise<StorageUsage> {
    return this.request<StorageUsage>("/storage-usage");
  }
}

export const filesApi = new FilesApiClient();
