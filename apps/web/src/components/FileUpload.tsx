import { useState } from "react";
import { filesApi } from "@/lib/files-api";
import { encryptAndUploadFile } from "@/lib/tauri-crypto";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

// MIME type detection from file extension
function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon',
    
    // Videos
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'webm': 'video/webm',
    'mkv': 'video/x-matroska',
    
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'rtf': 'application/rtf',
    'odt': 'application/vnd.oasis.opendocument.text',
    
    // Archives
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    
    // Code
    'js': 'text/javascript',
    'json': 'application/json',
    'ts': 'text/typescript',
    'tsx': 'text/typescript',
    'jsx': 'text/javascript',
    'html': 'text/html',
    'css': 'text/css',
    'xml': 'application/xml',
    'md': 'text/markdown',
    
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',
  };
  
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

export function FileUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSelectAndUpload = async () => {
    try {
      setUploading(true);
      setError(null);
      setSuccess(null);
      setProgress(5);

      // Step 1: Open file picker dialog
      const selected = await open({
        multiple: false,
        title: "Select a file to encrypt and upload",
      });

      if (!selected || typeof selected !== "string") {
        setUploading(false);
        return;
      }

      const filePath = selected;
      const filename = filePath.split("/").pop() || filePath.split("\\").pop() || "unknown";
      const mimeType = getMimeType(filename);
      
      console.log("📁 Selected file:", filePath);
      console.log("📄 MIME type:", mimeType);
      setProgress(10);

      // Step 2: Get file info from Tauri
      // We'll get the actual file size after encryption, but we can estimate it
      // Encrypted file will be slightly larger due to authentication tag
      const fileSize = 0; // Will be updated from encryption result

      // Step 3: Initialize upload on server
      console.log("🔄 Initializing upload on server...");
      
      let initResponse;
      try {
        initResponse = await filesApi.initUpload(
          filename,
          fileSize || 1, // Use 1 as placeholder if 0
          mimeType // Pass the detected MIME type
        );
      } catch (initError: any) {
        // Handle storage quota errors specifically
        if (initError.message && initError.message.includes("Storage quota exceeded")) {
          throw new Error(initError.message);
        }
        throw initError;
      }
      
      console.log("✅ Upload initialized:", initResponse);
      setProgress(20);

      // Step 3.5: Get user's public key for wrapping DEK
      const userKeysStr = localStorage.getItem("userKeypair");
      if (!userKeysStr) {
        throw new Error("You need to set up encryption keys first. Please generate your keypair.");
      }

      const userKeys = JSON.parse(userKeysStr);
      const userPublicKey = userKeys.x25519PublicKey || userKeys.x25519_public_key;
      
      if (!userPublicKey) {
        throw new Error("Invalid keypair data. Please regenerate your encryption keys.");
      }

      console.log("🔑 Using user's public key for DEK wrapping");

      // Step 4: Encrypt and upload using Tauri (with USER's public key, not server's)
      console.log("🔐 Encrypting and uploading file...");
      
      let uploadResponse;
      try {
        uploadResponse = await encryptAndUploadFile({
          file_path: filePath,
          server_public_key: userPublicKey, // Use user's key instead of server's!
          presigned_url: initResponse.presignedUrl,
          file_key: initResponse.s3Key,
        });
      } catch (uploadError: any) {
        console.error("❌ Upload to S3 failed:", uploadError);
        throw new Error(`Failed to upload file: ${uploadError.message || "Unknown error"}`);
      }
      
      console.log("✅ File encrypted and uploaded:", uploadResponse);
      setProgress(70);

      // Step 5: Complete upload on server
      console.log("💾 Completing upload on server...");
      await filesApi.completeUpload({
        fileId: initResponse.fileId,
        s3Key: uploadResponse.file_key,
        wrappedDek: uploadResponse.wrapped_dek,
        nonce: uploadResponse.nonce,
        originalFilename: uploadResponse.original_filename,
        fileSize: uploadResponse.file_size,
        mimeType: mimeType, // Include the detected MIME type
      });
      
      setProgress(100);
      setSuccess(`File "${filename}" uploaded successfully!`);
      
      console.log("✅ Upload complete!");
      
      // Reload the page after 1.5 seconds to show the new file
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (err) {
      console.error("❌ Upload error:", err);
      const errorMsg = err instanceof Error ? err.message : "Upload failed";
      setError(errorMsg);
    } finally {
      setUploading(false);
      setTimeout(() => {
        if (success) {
          setProgress(0);
          setSuccess(null);
        }
      }, 2000);
    }
  };

  return (
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

        <Button
          onClick={handleSelectAndUpload}
          disabled={uploading}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading... {progress}%
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Select and Upload File
            </>
          )}
        </Button>

        {uploading && <Progress value={progress} className="w-full" />}
      </CardContent>
    </Card>
  );
}
