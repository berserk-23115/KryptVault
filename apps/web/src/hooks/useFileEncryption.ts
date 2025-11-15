/**
 * Example integration of file encryption in a dashboard page
 * 
 * This shows how to:
 * 1. Upload encrypted files
 * 2. List encrypted files
 * 3. Download and decrypt files
 * 4. Delete files
 */

import { useState, useEffect } from "react";
import { filesApi } from "@/lib/files-api";
import {
  encryptAndUploadFile,
  downloadAndDecryptFile,
} from "@/lib/tauri-crypto";
import { open } from "@tauri-apps/plugin-dialog";
import { save } from "@tauri-apps/plugin-dialog";

// Example: Hook to get current user
// import { useAuth } from "@/lib/auth-client";

interface FileInfo {
  id: string;
  originalFilename: string;
  fileSize: number;
  mimeType?: string;
  createdAt: Date;
  description?: string;
}

export function useFileEncryption() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set user ID from your auth context
  // const { user } = useAuth();
  // useEffect(() => {
  //   if (user?.id) {
  //     filesApi.setUserId(user.id);
  //   }
  // }, [user?.id]);

  /**
   * Upload a file with encryption
   */
  const uploadFile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Open file picker dialog (Tauri)
      const selected = await open({
        multiple: false,
        title: "Select a file to encrypt and upload",
      });

      if (!selected || typeof selected !== "string") {
        return;
      }

      const filePath = selected;
      const filename = filePath.split("/").pop() || "unknown";

      // Get file size (you might need to use Tauri's fs plugin)
      // For now, we'll use a placeholder
      const fileSize = 0; // TODO: Get actual file size

      // Step 1: Initialize upload on server
      const initResponse = await filesApi.initUpload(filename, fileSize);

      // Step 2: Encrypt and upload via Tauri
      const uploadResponse = await encryptAndUploadFile({
        file_path: filePath,
        server_public_key: initResponse.serverPublicKey,
        presigned_url: initResponse.presignedUrl,
        file_key: initResponse.s3Key,
      });

      // Step 3: Complete upload on server
      await filesApi.completeUpload({
        fileId: initResponse.fileId,
        s3Key: uploadResponse.file_key,
        wrappedDek: uploadResponse.wrapped_dek,
        nonce: uploadResponse.nonce,
        originalFilename: uploadResponse.original_filename,
        fileSize: uploadResponse.file_size,
      });

      // Refresh file list
      await loadFiles();

      return initResponse.fileId;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Download and decrypt a file
   */
  const downloadFile = async (fileId: string, filename: string) => {
    try {
      setLoading(true);
      setError(null);

      // Open save dialog (Tauri)
      const savePath = await save({
        title: "Save decrypted file",
        defaultPath: filename,
      });

      if (!savePath) {
        return;
      }

      // Step 1: Get download info from server
      const downloadInfo = await filesApi.getDownloadInfo(fileId);

      // Step 2: Download and decrypt via Tauri
      await downloadAndDecryptFile({
        download_url: downloadInfo.downloadUrl,
        wrapped_dek: downloadInfo.wrappedDek,
        nonce: downloadInfo.nonce,
        server_public_key: downloadInfo.serverPublicKey,
        server_private_key: downloadInfo.serverPrivateKey,
        output_path: savePath,
      });

      return savePath;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Download failed";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Delete a file
   */
  const deleteFile = async (fileId: string) => {
    try {
      setLoading(true);
      setError(null);

      await filesApi.deleteFile(fileId);
      await loadFiles();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load file list
   */
  const loadFiles = async () => {
    try {
      setLoading(true);
      setError(null);

      const fileList = await filesApi.listFiles();
      setFiles(fileList as FileInfo[]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load files";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get file metadata
   */
  const getFile = async (fileId: string) => {
    try {
      return await filesApi.getFile(fileId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get file";
      setError(message);
      throw err;
    }
  };

  return {
    files,
    loading,
    error,
    uploadFile,
    downloadFile,
    deleteFile,
    loadFiles,
    getFile,
  };
}

// Example usage in a component:
/*
import { useFileEncryption } from "@/hooks/useFileEncryption";

export function MyDashboard() {
  const { files, loading, error, uploadFile, downloadFile, deleteFile, loadFiles } = useFileEncryption();

  useEffect(() => {
    loadFiles();
  }, []);

  return (
    <div>
      <button onClick={uploadFile}>Upload File</button>
      
      {error && <div className="error">{error}</div>}
      
      {files.map(file => (
        <div key={file.id}>
          <span>{file.originalFilename}</span>
          <button onClick={() => downloadFile(file.id, file.originalFilename)}>
            Download
          </button>
          <button onClick={() => deleteFile(file.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
*/
