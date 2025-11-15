import { useState } from "react";
import { filesApi } from "@/lib/files-api";
import { encryptAndUploadFile, downloadAndDecryptFile } from "@/lib/tauri-crypto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, Download, Trash2 } from "lucide-react";

interface FileRecord {
  id: string;
  originalFilename: string;
  fileSize: number;
  createdAt: Date;
  mimeType?: string;
}

export function FileUploadDemo() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Set user ID (you would get this from your auth context)
  // filesApi.setUserId("your-user-id");

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setSuccess(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file");
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(null);
      setProgress(10);

      // Step 1: Initialize upload on server
      const initResponse = await filesApi.initUpload(
        selectedFile.name,
        selectedFile.size,
        selectedFile.type
      );
      setProgress(20);

      // Step 2: Save file to temporary location (in production, use Tauri dialog)
      // For demo purposes, we'll simulate this
      const tempFilePath = `/tmp/${selectedFile.name}`;
      
      setProgress(30);

      // Step 3: Encrypt and upload using Tauri
      const uploadResponse = await encryptAndUploadFile({
        file_path: tempFilePath,
        server_public_key: initResponse.serverPublicKey,
        presigned_url: initResponse.presignedUrl,
        file_key: initResponse.s3Key,
      });
      setProgress(70);

      // Step 4: Complete upload on server
      await filesApi.completeUpload({
        fileId: initResponse.fileId,
        s3Key: uploadResponse.file_key,
        wrappedDek: uploadResponse.wrapped_dek,
        nonce: uploadResponse.nonce,
        originalFilename: uploadResponse.original_filename,
        fileSize: uploadResponse.file_size,
        mimeType: selectedFile.type,
      });
      setProgress(100);

      setSuccess(`File "${selectedFile.name}" uploaded successfully!`);
      setSelectedFile(null);
      loadFiles(); // Refresh file list
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const handleDownload = async (fileId: string, filename: string) => {
    try {
      setLoading(true);
      setError(null);

      // Step 1: Get download info from server
      const downloadInfo = await filesApi.getDownloadInfo(fileId);

      // Step 2: Download and decrypt using Tauri
      const outputPath = `/tmp/downloaded_${filename}`;
      
      await downloadAndDecryptFile({
        download_url: downloadInfo.downloadUrl,
        wrapped_dek: downloadInfo.wrappedDek,
        nonce: downloadInfo.nonce,
        server_public_key: downloadInfo.serverPublicKey,
        server_private_key: downloadInfo.serverPrivateKey,
        output_path: outputPath,
      });

      setSuccess(`File "${filename}" downloaded and decrypted to ${outputPath}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (fileId: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await filesApi.deleteFile(fileId);
      setSuccess(`File "${filename}" deleted successfully`);
      loadFiles(); // Refresh file list
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async () => {
    try {
      setLoading(true);
      const fileList = await filesApi.listFiles();
      setFiles(fileList as FileRecord[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Encrypted File Upload</CardTitle>
          <CardDescription>
            Files are encrypted client-side using XChaCha20-Poly1305 before upload
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-4">
            <Input
              type="file"
              onChange={handleFileSelect}
              disabled={uploading}
              className="flex-1"
            />
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="min-w-32"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </div>

          {uploading && <Progress value={progress} className="w-full" />}

          {selectedFile && (
            <p className="text-sm text-muted-foreground">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Your Files</CardTitle>
              <CardDescription>Encrypted files stored in the cloud</CardDescription>
            </div>
            <Button onClick={loadFiles} variant="outline" size="sm">
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && files.length === 0 ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            </div>
          ) : files.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No files uploaded yet
            </p>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{file.originalFilename}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.fileSize / 1024).toFixed(2)} KB •{" "}
                      {new Date(file.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleDownload(file.id, file.originalFilename)}
                      variant="outline"
                      size="sm"
                      disabled={loading}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(file.id, file.originalFilename)}
                      variant="outline"
                      size="sm"
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
