import { useState } from "react";
import { filesApi } from "@/lib/files-api";
import { createFolder, addFileToFolder, type CreateFolderRequest } from "@/lib/folders-api";
import { encryptAndUploadFile, generateFolderKey, wrapDekWithFolderKey, unwrapSharedDek } from "@/lib/tauri-crypto";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, FolderUp } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

export function FolderUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<string>("");
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [folderName, setFolderName] = useState("New Folder");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  const handleSelectAndUpload = async () => {
    try {
      // Step 1: Open file picker dialog for multiple files
      const selected = await open({
        multiple: true,
        title: "Select files to upload to a new folder",
      });

      if (!selected || (Array.isArray(selected) && selected.length === 0)) {
        return;
      }

      const filePaths = Array.isArray(selected) ? selected : [selected];
      setSelectedFiles(filePaths);
      setFolderName("New Folder");
      setShowFolderDialog(true);
    } catch (err) {
      console.error("File selection error:", err);
      toast.error("Failed to select files");
    }
  };

  const handleStartUpload = async () => {
    let toastId: string | number | undefined;

    try {
      if (!folderName.trim()) {
        toast.error("Please enter a folder name");
        return;
      }

      setShowFolderDialog(false);
      setUploading(true);
      setError(null);
      setSuccess(null);
      setProgress(5);

      console.log(`📁 Creating folder "${folderName}" with ${selectedFiles.length} files`);
      toastId = toast.loading(`Uploading folder: ${folderName}`, {
        description: "Preparing folder...",
      });

      setProgress(10);

      // Step 2: Check for user keypair
      const userKeysStr = localStorage.getItem("userKeypair");
      if (!userKeysStr) {
        throw new Error("You need to set up encryption keys first");
      }

      const userKeys = JSON.parse(userKeysStr);
      const userPublicKey = userKeys.x25519PublicKey || userKeys.x25519_public_key;
      const userPrivateKey = userKeys.x25519PrivateKey || userKeys.x25519_private_key;

      if (!userPublicKey || !userPrivateKey) {
        throw new Error("Invalid keypair data. Please regenerate your encryption keys.");
      }

      // Step 3: Generate folder key
      toast.loading(`Uploading folder: ${folderName}`, {
        id: toastId,
        description: "Generating folder encryption key...",
      });

      const folderKeyBase64 = await generateFolderKey();
      console.log("🔑 Generated folder key");
      setProgress(15);

      // Step 4: Wrap folder key with user's public key using sealed box
      const wrappedFolderKey = await invoke<string>("seal_data", {
        data: folderKeyBase64,
        recipientPublicKey: userPublicKey,
      });
      console.log("🔐 Wrapped folder key with user's public key");
      setProgress(20);

      // Step 5: Create folder on server
      toast.loading(`Uploading folder: ${folderName}`, {
        id: toastId,
        description: "Creating folder...",
      });

      const createFolderRequest: CreateFolderRequest = {
        name: folderName,
        description: `Uploaded folder with ${selectedFiles.length} file(s)`,
        wrappedFolderKey: wrappedFolderKey,
      };

      const { folderId } = await createFolder(createFolderRequest);
      console.log("📁 Created folder:", folderId);
      setProgress(25);

      // Step 6: Upload each file
      const progressPerFile = 70 / selectedFiles.length;
      let completedFiles = 0;

      for (const filePath of selectedFiles) {
        const filename = filePath.split("/").pop() || filePath.split("\\").pop() || "unknown";

        setCurrentFile(filename);
        toast.loading(`Uploading folder: ${folderName}`, {
          id: toastId,
          description: `Uploading ${filename} (${completedFiles + 1}/${selectedFiles.length})...`,
        });

        console.log(`📄 Processing file: ${filename}`);

        // Initialize upload
        const initResponse = await filesApi.initUpload(filename, 1, "");
        const { fileId, s3Key, presignedUrl } = initResponse;

        // Encrypt and upload file with user's public key
        const encryptResult = await encryptAndUploadFile({
          file_path: filePath,
          server_public_key: userPublicKey,
          presigned_url: presignedUrl,
          file_key: s3Key,
        });

        // Complete upload
        await filesApi.completeUpload({
          fileId,
          s3Key: encryptResult.file_key,
          wrappedDek: encryptResult.wrapped_dek,
          nonce: encryptResult.nonce,
          originalFilename: encryptResult.original_filename,
          fileSize: encryptResult.file_size,
        });

        // Now wrap the file's DEK with folder key
        // First unwrap the DEK (it's wrapped with user's key)
        const unwrappedDek = await unwrapSharedDek(
          encryptResult.wrapped_dek,
          userPublicKey,
          userPrivateKey
        );

        // Then wrap it with the folder key
        const wrappedDekForFolder = await wrapDekWithFolderKey({
          dek_b64: unwrappedDek,
          folder_key_b64: folderKeyBase64,
        });

        // Add file to folder
        await addFileToFolder({
          fileId,
          folderId,
          wrappedDek: wrappedDekForFolder.wrapped_dek,
          wrappingNonce: wrappedDekForFolder.wrapping_nonce,
        });

        completedFiles++;
        setProgress(25 + (completedFiles * progressPerFile));
        console.log(`✅ Uploaded and added to folder: ${filename}`);
      }

      setProgress(100);
      setSuccess(`Successfully uploaded folder "${folderName}" with ${selectedFiles.length} file(s)!`);
      
      toast.success("Folder uploaded!", {
        id: toastId,
        description: `${folderName} with ${selectedFiles.length} file(s) uploaded successfully`,
      });

      // Reload page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err) {
      console.error("Folder upload error:", err);
      const errorMessage = err instanceof Error ? err.message : "Folder upload failed";
      setError(errorMessage);
      
      if (toastId) {
        toast.error("Folder upload failed", {
          id: toastId,
          description: errorMessage,
        });
      } else {
        toast.error("Folder upload failed", {
          description: errorMessage,
        });
      }
    } finally {
      setUploading(false);
      setCurrentFile("");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderUp className="h-5 w-5" />
            Folder Upload
          </CardTitle>
          <CardDescription>
            Select multiple files to upload as a secure encrypted folder
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-500 text-green-700 dark:text-green-400">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                {currentFile ? `Uploading: ${currentFile}` : "Processing..."}
              </p>
            </div>
          )}

          <Button
            onClick={handleSelectAndUpload}
            disabled={uploading}
            className="w-full"
            size="lg"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading... {Math.round(progress)}%
              </>
            ) : (
              <>
                <FolderUp className="mr-2 h-4 w-4" />
                Select Files to Upload as Folder
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Folder Name Dialog */}
      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Enter a name for your encrypted folder containing {selectedFiles.length} file(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleStartUpload();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFolderDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleStartUpload}>
              Create & Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
