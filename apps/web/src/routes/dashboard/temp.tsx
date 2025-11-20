import { authClient } from "@/lib/auth-client";
import { createFileRoute, redirect } from "@tanstack/react-router";
import React from "react";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/FileUpload";
import { FolderUpload } from "@/components/FolderUpload";
import { filesApi, type FileMetadata } from "@/lib/files-api";
import { save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { FileIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ShareFileDialog } from "@/components/ShareFileDialog";
import { KeypairSetupDialog, useKeypairCheck } from "@/components/KeypairSetupDialog";
import { FileSidebar } from "@/components/FileSidebar";

export const Route = createFileRoute("/dashboard/temp")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({ to: "/login", throw: true });
    }
    return { session };
  },
});

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const [files, setFiles] = React.useState<FileMetadata[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedFile, setSelectedFile] = React.useState<FileMetadata | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false);
  const { hasKeypair, checking: checkingKeypair, recheckKeypair } = useKeypairCheck();
  const [showKeypairSetup, setShowKeypairSetup] = React.useState(false);

  // Show keypair setup dialog if user doesn't have one
  React.useEffect(() => {
    if (!checkingKeypair && hasKeypair === false) {
      setShowKeypairSetup(true);
    }
  }, [hasKeypair, checkingKeypair]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const fileList = await filesApi.listFiles();
      // Normalize fileId to id for compatibility
      const normalizedFiles = fileList.map(file => ({
        ...file,
        id: file.fileId || file.id,
      }));
      setFiles(normalizedFiles);
    } catch (err) {
      console.error("Failed to load files:", err);
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadFiles();
  }, []);

  const handleFileClick = (file: FileMetadata) => {
    setSelectedFile(file);
  };

  const handleDownload = async (file: FileMetadata) => {
    let toastId: string | number | undefined;
    
    try {
      setError(null);
      
      // Get user's keypair from localStorage
      const userKeysStr = localStorage.getItem("userKeypair");
      if (!userKeysStr) {
        throw new Error("Encryption keys not found. Please set up your keypair first.");
      }

      const userKeys = JSON.parse(userKeysStr);
      const userPublicKey = userKeys.x25519PublicKey || userKeys.x25519_public_key;
      const userPrivateKey = userKeys.x25519PrivateKey || userKeys.x25519_private_key;
      
      if (!userPublicKey || !userPrivateKey) {
        throw new Error("Invalid keypair data. Please regenerate your encryption keys.");
      }

      // Open save dialog
      const savePath = await save({
        title: "Save decrypted file",
        defaultPath: file.originalFilename,
      });

      if (!savePath) return;

      // Show initial toast
      toastId = toast.loading(`Downloading ${file.originalFilename}...`, {
        description: "Fetching download URL...",
      });

      // Get download info
      toast.loading(`Downloading ${file.originalFilename}...`, {
        id: toastId,
        description: "Retrieving encryption keys...",
      });
      
      const downloadInfo = await filesApi.getDownloadInfo(file.id);

      // Unwrap the DEK using user's private key
      toast.loading(`Downloading ${file.originalFilename}...`, {
        id: toastId,
        description: "Unwrapping encryption key...",
      });

      const { unwrapSharedDek, downloadAndDecryptSharedFile } = await import("@/lib/tauri-crypto");
      const dekBase64 = await unwrapSharedDek(
        downloadInfo.wrappedDek,
        userPublicKey,
        userPrivateKey
      );

      // Download and decrypt using the unwrapped DEK
      toast.loading(`Downloading ${file.originalFilename}...`, {
        id: toastId,
        description: "Downloading and decrypting file...",
      });

      await downloadAndDecryptSharedFile(
        downloadInfo.downloadUrl,
        dekBase64,
        downloadInfo.nonce,
        savePath
      );

      // Success
      toast.success(`Download complete!`, {
        id: toastId,
        description: `Saved to: ${savePath}`,
      });
    } catch (err) {
      console.error("Download error:", err);
      const errorMessage = err instanceof Error ? err.message : "Download failed";
      setError(errorMessage);
      
      if (toastId) {
        toast.error("Download failed", {
          id: toastId,
          description: errorMessage,
        });
      } else {
        toast.error("Download failed", {
          description: errorMessage,
        });
      }
    }
  };

  const handlePreview = async (file: FileMetadata) => {
    let toastId: string | number | undefined;
    
    try {
      setError(null);
      
      // Get user's keypair from localStorage
      const userKeysStr = localStorage.getItem("userKeypair");
      if (!userKeysStr) {
        throw new Error("Encryption keys not found. Please set up your keypair first.");
      }

      const userKeys = JSON.parse(userKeysStr);
      const userPublicKey = userKeys.x25519PublicKey || userKeys.x25519_public_key;
      const userPrivateKey = userKeys.x25519PrivateKey || userKeys.x25519_private_key;
      
      if (!userPublicKey || !userPrivateKey) {
        throw new Error("Invalid keypair data. Please regenerate your encryption keys.");
      }

      // Show initial toast
      toastId = toast.loading(`Preparing preview for ${file.originalFilename}...`, {
        description: "Fetching file...",
      });
      
      // For preview, download to temp location
      const tempPath = `/tmp/preview_${file.originalFilename}`;
      
      // Get download info
      toast.loading(`Preparing preview for ${file.originalFilename}...`, {
        id: toastId,
        description: "Retrieving encryption keys...",
      });
      
      const downloadInfo = await filesApi.getDownloadInfo(file.id);

      // Unwrap the DEK using user's private key
      toast.loading(`Preparing preview for ${file.originalFilename}...`, {
        id: toastId,
        description: "Unwrapping encryption key...",
      });

      const { unwrapSharedDek, downloadAndDecryptSharedFile } = await import("@/lib/tauri-crypto");
      const dekBase64 = await unwrapSharedDek(
        downloadInfo.wrappedDek,
        userPublicKey,
        userPrivateKey
      );

      // Download and decrypt using the unwrapped DEK
      toast.loading(`Preparing preview for ${file.originalFilename}...`, {
        id: toastId,
        description: "Downloading and decrypting...",
      });

      await downloadAndDecryptSharedFile(
        downloadInfo.downloadUrl,
        dekBase64,
        downloadInfo.nonce,
        tempPath
      );

      toast.success("Preview ready!", {
        id: toastId,
        description: `File decrypted at: ${tempPath}`,
      });
    } catch (err) {
      console.error("Preview error:", err);
      const errorMessage = err instanceof Error ? err.message : "Preview failed";
      setError(errorMessage);
      
      if (toastId) {
        toast.error("Preview failed", {
          id: toastId,
          description: errorMessage,
        });
      } else {
        toast.error("Preview failed", {
          description: errorMessage,
        });
      }
    }
  };

  const handleDelete = async (file: FileMetadata) => {
    if (!confirm(`Are you sure you want to delete "${file.originalFilename}"?`)) {
      return;
    }

    const toastId = toast.loading(`Deleting ${file.originalFilename}...`);

    try {
      setError(null);
      await filesApi.deleteFile(file.id);
      await loadFiles();
      setSelectedFile(null);
      
      toast.success("File deleted", {
        id: toastId,
        description: `${file.originalFilename} has been deleted successfully.`,
      });
    } catch (err) {
      console.error("Delete error:", err);
      const errorMessage = err instanceof Error ? err.message : "Delete failed";
      setError(errorMessage);
      
      toast.error("Delete failed", {
        id: toastId,
        description: errorMessage,
      });
    }
  };

  return (
    <main className="flex h-full overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Storage Section */}
        <div className="w-full rounded-xl p-6 shadow-lg border 
          border-neutral-300 dark:border-neutral-700 
          bg-white/50 dark:bg-white/10 backdrop-blur-xl">
          <h2 className="text-xl font-semibold mb-4">Storage</h2>
          <div className="w-full h-4 rounded-full overflow-hidden flex bg-neutral-200 dark:bg-neutral-700">
            <div className="bg-blue-500" style={{ width: "10%" }} />
            <div className="bg-red-500" style={{ width: "20%" }} />
            <div className="bg-green-500" style={{ width: "15%" }} />
            <div className="bg-yellow-500" style={{ width: "55%" }} />
          </div>
          <div className="flex gap-8 mt-4 text-sm">
            <Legend color="bg-blue-500" label="Images (10%)" />
            <Legend color="bg-red-500" label="Videos (20%)" />
            <Legend color="bg-green-500" label="Documents (15%)" />
            <Legend color="bg-yellow-500" label="Others (55%)" />
          </div>
        </div>

        {/* File Upload */}
        {/* <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <FileUpload />
          <FolderUpload />
        </div> */}

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500">
            {error}
          </div>
        )}

        {/* Recent Files */}
        <section className="mt-6">
          <div className="p-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Recent Files</h2>
              
            </div>

            {loading ? (
              <div className="text-center py-12 text-neutral-500">Loading files...</div>
            ) : files.length === 0 ? (
              <div className="text-center py-12 text-neutral-500">
                No files yet. Upload your first file!
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {files.slice(0, 12).map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    onClick={() => handleFileClick(file)}
                    isSelected={selectedFile?.id === file.id}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Right Sidebar using FileSidebar component */}
      {selectedFile && (
        <FileSidebar
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onPreview={handlePreview}
          onDownload={handleDownload}
          onDelete={handleDelete}
          onShare={() => {
            if (!hasKeypair) {
              toast.error("Please set up encryption first");
              setShowKeypairSetup(true);
              return;
            }
            setShareDialogOpen(true);
          }}
          ownerName={selectedFile.ownerName || selectedFile.ownerEmail || "Unknown"}
          showShareButton={true}
          isSharedFile={selectedFile.isOwner === false}
        />
      )}

      {/* Share Dialog */}
      {selectedFile && (
        <ShareFileDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          fileId={selectedFile.id}
          fileName={selectedFile.originalFilename}
          wrappedDek={selectedFile.wrappedDek || ""}
          currentUserId={session.data?.user?.id}
          onShareComplete={() => {
            loadFiles();
          }}
        />
      )}

      {/* Keypair Setup Dialog */}
      <KeypairSetupDialog
        open={showKeypairSetup}
        onComplete={() => {
          setShowKeypairSetup(false);
          recheckKeypair();
          toast.success("You can now share files securely!");
        }}
      />
    </main>
  );
}

// Helper Components
function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-4 h-4 rounded-sm ${color}`}></span>
      {label}
    </div>
  );
}

function FileCard({ 
  file, 
  onClick,
  isSelected 
}: { 
  file: FileMetadata; 
  onClick: () => void;
  isSelected?: boolean;
}) {
  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    const iconMap: Record<string, string> = {
      pdf: '📄',
      doc: '📝', docx: '📝',
      xls: '📊', xlsx: '📊',
      ppt: '📊', pptx: '📊',
      jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️',
      mp4: '🎥', mov: '🎥', avi: '🎥',
      mp3: '🎵', wav: '🎵',
      zip: '🗜️', rar: '🗜️', '7z': '🗜️',
      txt: '📃',
    };
    
    return iconMap[ext || ''] || '📁';
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-xl overflow-hidden shadow-md border 
      ${isSelected ? 'border-purple-500 ring-2 ring-purple-500' : 'border-neutral-300 dark:border-neutral-700'}
      bg-white dark:bg-purple-900/20 
      hover:scale-[1.02] hover:shadow-lg transition cursor-pointer`}
    >
      <div className="h-36 w-full bg-linear-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
        <span className="text-6xl">{getFileIcon(file.originalFilename)}</span>
      </div>

      <div className="p-4">
        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
          {file.originalFilename}
        </p>
        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
          {formatFileSize(file.fileSize)}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
          {new Date(file.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
