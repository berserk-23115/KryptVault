import { authClient } from "@/lib/auth-client";
import { createFileRoute, redirect } from "@tanstack/react-router";
import React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/FileUpload";
import { filesApi, type FileMetadata } from "@/lib/files-api";
import { downloadAndDecryptFile } from "@/lib/tauri-crypto";
import { save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { 
  FileIcon, 
  DownloadIcon, 
  TrashIcon, 
  CalendarIcon,
  HardDriveIcon,
  UserIcon,
  EyeIcon,
  XIcon,
  Share2Icon
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShareFileDialog } from "@/components/ShareFileDialog";
import { KeypairSetupDialog, useKeypairCheck } from "@/components/KeypairSetupDialog";

export const Route = createFileRoute("/dashboard/")({
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

  const handleFileDoubleClick = async (file: FileMetadata) => {
    await handlePreview(file);
  };

  const handleDownload = async (file: FileMetadata) => {
    let toastId: string | number | undefined;
    
    try {
      setError(null);
      
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

      // Download and decrypt
      toast.loading(`Downloading ${file.originalFilename}...`, {
        id: toastId,
        description: "Downloading and decrypting file...",
      });

      await downloadAndDecryptFile({
        download_url: downloadInfo.downloadUrl,
        wrapped_dek: downloadInfo.wrappedDek,
        nonce: downloadInfo.nonce,
        server_public_key: downloadInfo.serverPublicKey,
        server_private_key: downloadInfo.serverPrivateKey,
        output_path: savePath,
      });

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

      // Download and decrypt
      toast.loading(`Preparing preview for ${file.originalFilename}...`, {
        id: toastId,
        description: "Downloading and decrypting...",
      });

      await downloadAndDecryptFile({
        download_url: downloadInfo.downloadUrl,
        wrapped_dek: downloadInfo.wrappedDek,
        nonce: downloadInfo.nonce,
        server_public_key: downloadInfo.serverPublicKey,
        server_private_key: downloadInfo.serverPrivateKey,
        output_path: tempPath,
      });

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
        <div className="mt-6">
          <FileUpload />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500">
            {error}
          </div>
        )}

        {/* Recent Files */}
        <section className="mt-6">
          <div className="p-6 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-purple-900/20 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Recent Files</h2>
              <Button
                onClick={loadFiles}
                variant="outline"
                size="sm"
              >
                Refresh
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-12 text-neutral-500">Loading files...</div>
            ) : files.length === 0 ? (
              <div className="text-center py-12 text-neutral-500">
                No files yet. Upload your first file!
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {files.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    onClick={() => handleFileClick(file)}
                    onDoubleClick={() => handleFileDoubleClick(file)}
                    isSelected={selectedFile?.id === file.id}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Right Sidebar */}
      {selectedFile && (
        <aside className="w-96 border-l border-border bg-card flex flex-col overflow-y-auto">
          <div className="p-6 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileIcon className="h-5 w-5 shrink-0" />
                <h2 className="text-lg font-semibold truncate">
                  {selectedFile.originalFilename}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFile(null)}
                className="shrink-0"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
              File details and actions
            </p>

            {/* Preview Placeholder */}
            <div className="aspect-video bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center mb-6">
              <FileIcon className="h-16 w-16 text-neutral-400" />
            </div>

            {/* File Info - Scrollable */}
            <div className="space-y-4 mb-6 flex-1 overflow-y-auto">
              <div>
                <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-1">
                  <HardDriveIcon className="h-4 w-4" />
                  <span>Size</span>
                </div>
                <p className="text-lg font-medium">
                  {formatFileSize(selectedFile.fileSize)}
                </p>
              </div>

              <Separator />

              <div>
                <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-1">
                  <CalendarIcon className="h-4 w-4" />
                  <span>Created</span>
                </div>
                <p className="text-lg font-medium">
                  {new Date(selectedFile.createdAt).toLocaleString()}
                </p>
              </div>

              <Separator />

              <div>
                <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-1">
                  <UserIcon className="h-4 w-4" />
                  <span>Owner</span>
                </div>
                <p className="text-lg font-medium">
                  {session.data?.user?.name || session.data?.user?.email || "Unknown"}
                </p>
              </div>

              {selectedFile.mimeType && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-1">
                      <FileIcon className="h-4 w-4" />
                      <span>Type</span>
                    </div>
                    <p className="text-lg font-medium">
                      {selectedFile.mimeType}
                    </p>
                  </div>
                </>
              )}

              <Separator />

              <div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                  Status
                </div>
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">Encrypted</span>
                </div>
              </div>
            </div>

            {/* Actions - Fixed at Bottom */}
            <div className="space-y-2 pt-6 border-t border-border">
              <Button
                onClick={() => {
                  if (!hasKeypair) {
                    toast.error("Please set up encryption first");
                    setShowKeypairSetup(true);
                    return;
                  }
                  setShareDialogOpen(true);
                }}
                className="w-full"
                variant="outline"
                disabled={!selectedFile.wrappedDek}
                title={!selectedFile.wrappedDek ? "This file cannot be shared (legacy format)" : "Share this file"}
              >
                <Share2Icon className="h-4 w-4 mr-2" />
                Share File
              </Button>
              
              <Button
                onClick={() => handlePreview(selectedFile)}
                className="w-full"
                variant="outline"
              >
                <EyeIcon className="h-4 w-4 mr-2" />
                Preview
              </Button>
              
              <Button
                onClick={() => handleDownload(selectedFile)}
                className="w-full"
                variant="default"
              >
                <DownloadIcon className="h-4 w-4 mr-2" />
                Download
              </Button>

              <Button
                onClick={() => handleDelete(selectedFile)}
                className="w-full"
                variant="destructive"
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </aside>
      )}

      {/* Share Dialog */}
      {selectedFile && (
        <ShareFileDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          fileId={selectedFile.id}
          fileName={selectedFile.originalFilename}
          wrappedDek={selectedFile.wrappedDek || ""}
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
  onDoubleClick,
  isSelected 
}: { 
  file: FileMetadata; 
  onClick: () => void;
  onDoubleClick: () => void;
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
      onDoubleClick={onDoubleClick}
      className={`rounded-xl overflow-hidden shadow-md border 
      ${isSelected ? 'border-purple-500 ring-2 ring-purple-500' : 'border-neutral-300 dark:border-neutral-700'}
      bg-white dark:bg-purple-900/20 
      hover:scale-[1.02] hover:shadow-lg transition cursor-pointer`}
    >
      <div className="h-36 w-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
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
