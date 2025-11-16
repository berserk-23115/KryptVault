import { useState } from "react";
import { filesApi } from "@/lib/files-api";
import { encryptAndUploadFile } from "@/lib/tauri-crypto";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

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
      
      console.log("📁 Selected file:", filePath);
      setProgress(10);

      // Step 2: Get file info (we'll use Tauri to get file size)
      // For now, we'll pass 0 and update it after encryption
      const fileSize = 0; // Will be updated from encryption result

      // Step 3: Initialize upload on server
      console.log("🔄 Initializing upload on server...");
      const initResponse = await filesApi.initUpload(
        filename,
        fileSize || 1, // Use 1 as placeholder if 0
        "" // We don't know mime type yet
      );
      
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
      const uploadResponse = await encryptAndUploadFile({
        file_path: filePath,
        server_public_key: userPublicKey, // Use user's key instead of server's!
        presigned_url: initResponse.presignedUrl,
        file_key: initResponse.s3Key,
      });
      
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
      });
      
      setProgress(100);
      setSuccess(`File "${filename}" uploaded successfully!`);
      
      console.log("✅ Upload complete!");
      
    } catch (err) {
      console.error("❌ Upload error:", err);
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1000);
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
