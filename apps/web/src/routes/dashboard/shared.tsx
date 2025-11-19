import { createFileRoute, redirect } from "@tanstack/react-router";
import React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileIcon, Share2Icon, Grid3x3, List } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { getSharedWithMe, getSharedByMe, type SharedFile, type ShareRecord } from "@/lib/sharing-api";
import { downloadAndDecryptSharedFile, unwrapSharedDek } from "@/lib/tauri-crypto";
import { save } from "@tauri-apps/plugin-dialog";
import { FileSidebar } from "@/components/FileSidebar";
import { filesApi, type FileMetadata } from "@/lib/files-api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ButtonGroup } from "@/components/ui/button-group";

export const Route = createFileRoute("/dashboard/shared")({
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
  const [sharedWithMeFiles, setSharedWithMeFiles] = React.useState<SharedFile[]>([]);
  const [sharedByMeRecords, setSharedByMeRecords] = React.useState<ShareRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedFile, setSelectedFile] = React.useState<SharedFile | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");

  const loadSharedFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load shared with me files
      const filesSharedWithMe = await getSharedWithMe();
      
      // Filter out files where the current user is the one who shared it
      // These should be files shared by OTHER users only
      const currentUserEmail = session?.data?.user?.email;
      const sharedFilesFromOthers = filesSharedWithMe.filter(file => file.sharedByEmail !== currentUserEmail);
      
      console.log("All files:", filesSharedWithMe);
      console.log("Current user email:", currentUserEmail);
      console.log("Filtered files:", sharedFilesFromOthers);
      
      setSharedWithMeFiles(sharedFilesFromOthers);

      // Load shared by me records
      const filesSharedByMe = await getSharedByMe();
      setSharedByMeRecords(filesSharedByMe);
      console.log("Files shared by me:", filesSharedByMe);
    } catch (err) {
      console.error("Failed to load shared files:", err);
      const errorMsg = err instanceof Error ? err.message : "Failed to load shared files";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadSharedFiles();
  }, []);

  const handleFileClick = (file: SharedFile) => {
    setSelectedFile(file);
  };

  const handleFileDoubleClick = async (file: SharedFile) => {
    await handlePreview(file);
  };

  const handleDownload = async (file: SharedFile) => {
    let toastId: string | number | undefined;

    try {
      setError(null);

      // Check for user keys
      const userKeysStr = localStorage.getItem("userKeypair");
      if (!userKeysStr) {
        toast.error("You need to set up encryption keys first");
        return;
      }

      const userKeys = JSON.parse(userKeysStr);
      const userPublicKey = userKeys.x25519PublicKey || userKeys.x25519_public_key;
      const userPrivateKey = userKeys.x25519PrivateKey || userKeys.x25519_private_key;

      if (!userPublicKey || !userPrivateKey) {
        toast.error("Invalid keypair data. Please regenerate your encryption keys.");
        return;
      }

      // Open save dialog
      const savePath = await save({
        title: "Save decrypted file",
        defaultPath: file.originalFilename,
      });

      if (!savePath) return;

      toastId = toast.loading(`Downloading ${file.originalFilename}...`, {
        description: "Unwrapping encryption key...",
      });

      // Unwrap the DEK that was shared with us
      const dekBase64 = await unwrapSharedDek(
        file.wrappedDek,
        userPublicKey,
        userPrivateKey
      );

      // Get presigned download URL from server
      toast.loading(`Downloading ${file.originalFilename}...`, {
        id: toastId,
        description: "Getting download URL...",
      });

      const downloadInfo = await filesApi.getDownloadInfo(file.fileId);

      toast.loading(`Downloading ${file.originalFilename}...`, {
        id: toastId,
        description: "Downloading and decrypting file...",
      });

      // Download and decrypt the shared file using the unwrapped DEK
      await downloadAndDecryptSharedFile(
        downloadInfo.downloadUrl,
        dekBase64,
        file.nonce,
        savePath
      );

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

  const handlePreview = async (file: SharedFile) => {
    toast.info("Preview feature coming soon for shared files!");
  };

  // Convert SharedFile to FileMetadata for sidebar compatibility
  const convertToFileMetadata = (file: SharedFile): FileMetadata => {
    return {
      id: file.fileId,
      fileId: file.fileId,
      originalFilename: file.originalFilename,
      mimeType: file.mimeType || undefined,
      fileSize: file.fileSize,
      createdAt: file.sharedAt,
      updatedAt: file.sharedAt,
      userId: "", // Not the owner
      s3Key: file.s3Key,
      s3Bucket: file.s3Bucket,
      nonce: file.nonce,
      wrappedDek: file.wrappedDek,
      description: undefined,
      tags: undefined,
      folderId: undefined,
      isOwner: false,
    };
  };

  return (
    <main className="flex h-full overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Header Section */}
        <div className="w-full rounded-xl p-6 shadow-lg border 
          border-neutral-300 dark:border-neutral-700 
          bg-white/50 dark:bg-white/10 backdrop-blur-xl mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Share2Icon className="h-6 w-6 text-blue-500" />
            <h2 className="text-2xl font-semibold">Sharing</h2>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Manage files you've shared and files shared with you
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500">
            {error}
          </div>
        )}

        {/* Tabs Section */}
        <Tabs defaultValue="shared-with-me" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="shared-with-me">Shared With Me</TabsTrigger>
            <TabsTrigger value="shared-by-me">Shared By Me</TabsTrigger>
          </TabsList>

          {/* Shared With Me Tab */}
          <TabsContent value="shared-with-me" className="space-y-4">
            <section>
              <div className="p-6 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-purple-900/20 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">
                    {sharedWithMeFiles.length} {sharedWithMeFiles.length === 1 ? 'File' : 'Files'} Shared With Me
                  </h2>
                  <div className="flex items-center gap-3">
                    <Button onClick={loadSharedFiles} variant="outline" size="sm">
                      Refresh
                    </Button>
                    <ButtonGroup>
                      <Button
                        onClick={() => setViewMode("list")}
                        variant={viewMode === "list" ? "default" : "outline"}
                        className={`gap-2 ${viewMode === "list" ? "bg-purple-600 hover:bg-purple-700" : "bg-neutral-900 border-neutral-700 text-white hover:bg-neutral-800"}`}
                      >
                        <List className="h-4 w-4" />
                        List
                      </Button>
                      <Button
                        onClick={() => setViewMode("grid")}
                        variant={viewMode === "grid" ? "default" : "outline"}
                        className={`gap-2 ${viewMode === "grid" ? "bg-purple-600 hover:bg-purple-700" : "bg-neutral-900 border-neutral-700 text-white hover:bg-neutral-800"}`}
                      >
                        <Grid3x3 className="h-4 w-4" />
                        Grid
                      </Button>
                    </ButtonGroup>
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-12 text-neutral-500">
                    Loading shared files...
                  </div>
                ) : sharedWithMeFiles.length === 0 ? (
                  <div className="text-center py-12">
                    <Share2Icon className="h-16 w-16 text-neutral-400 mx-auto mb-4" />
                    <p className="text-neutral-500 mb-2">No files shared with you yet</p>
                    <p className="text-sm text-neutral-400">
                      When someone shares a file with you, it will appear here
                    </p>
                  </div>
                ) : viewMode === "list" ? (
                  // LIST VIEW
                  <div className="space-y-2">
                    {sharedWithMeFiles.map((file) => (
                      <SharedFileListItem
                        key={file.fileId}
                        file={file}
                        onClick={() => handleFileClick(file)}
                        isSelected={selectedFile?.fileId === file.fileId}
                      />
                    ))}
                  </div>
                ) : (
                  // GRID VIEW
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    {sharedWithMeFiles.map((file) => (
                      <SharedFileCard
                        key={file.fileId}
                        file={file}
                        onClick={() => handleFileClick(file)}
                        onDoubleClick={() => handleFileDoubleClick(file)}
                        isSelected={selectedFile?.fileId === file.fileId}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          </TabsContent>

          {/* Shared By Me Tab */}
          <TabsContent value="shared-by-me" className="space-y-4">
            <section>
              <div className="p-6 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-purple-900/20 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">
                    {sharedByMeRecords.length} {sharedByMeRecords.length === 1 ? 'Share' : 'Shares'} From Me
                  </h2>
                  <div className="flex items-center gap-3">
                    <Button onClick={loadSharedFiles} variant="outline" size="sm">
                      Refresh
                    </Button>
                    <ButtonGroup>
                      <Button
                        onClick={() => setViewMode("list")}
                        variant={viewMode === "list" ? "default" : "outline"}
                        className={`gap-2 ${viewMode === "list" ? "bg-purple-600 hover:bg-purple-700" : "bg-neutral-900 border-neutral-700 text-white hover:bg-neutral-800"}`}
                      >
                        <List className="h-4 w-4" />
                        List
                      </Button>
                      <Button
                        onClick={() => setViewMode("grid")}
                        variant={viewMode === "grid" ? "default" : "outline"}
                        className={`gap-2 ${viewMode === "grid" ? "bg-purple-600 hover:bg-purple-700" : "bg-neutral-900 border-neutral-700 text-white hover:bg-neutral-800"}`}
                      >
                        <Grid3x3 className="h-4 w-4" />
                        Grid
                      </Button>
                    </ButtonGroup>
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-12 text-neutral-500">
                    Loading shared files...
                  </div>
                ) : sharedByMeRecords.length === 0 ? (
                  <div className="text-center py-12">
                    <Share2Icon className="h-16 w-16 text-neutral-400 mx-auto mb-4" />
                    <p className="text-neutral-500 mb-2">You haven't shared any files yet</p>
                    <p className="text-sm text-neutral-400">
                      When you share a file with someone, it will appear here
                    </p>
                  </div>
                ) : viewMode === "list" ? (
                  // LIST VIEW
                  <div className="space-y-2">
                    {sharedByMeRecords.map((share) => (
                      <SharedByMeCard
                        key={`${share.fileId}-${share.recipientUserId}`}
                        share={share}
                      />
                    ))}
                  </div>
                ) : (
                  // GRID VIEW
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    {sharedByMeRecords.map((share) => (
                      <SharedByMeCardGrid
                        key={`${share.fileId}-${share.recipientUserId}`}
                        share={share}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </div>

      {/* Right Sidebar using FileSidebar component */}
      {selectedFile && (
        <FileSidebar
          file={convertToFileMetadata(selectedFile)}
          onClose={() => setSelectedFile(null)}
          onPreview={(file) => handlePreview(selectedFile)}
          onDownload={(file) => handleDownload(selectedFile)}
          ownerName={selectedFile.sharedByEmail}
          showShareButton={false}
          isSharedFile={true}
        />
      )}
    </main>
  );
}

// Shared File List Item Component
function SharedFileListItem({
  file,
  onClick,
  isSelected,
}: {
  file: SharedFile;
  onClick: () => void;
  isSelected?: boolean;
}) {
  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      pdf: "📄",
      doc: "📝",
      docx: "📝",
      xls: "📊",
      xlsx: "📊",
      ppt: "📊",
      pptx: "📊",
      jpg: "🖼️",
      jpeg: "🖼️",
      png: "🖼️",
      gif: "🖼️",
      svg: "🖼️",
      mp4: "🎥",
      mov: "🎥",
      avi: "🎥",
      mp3: "🎵",
      wav: "🎵",
      zip: "🗜️",
      rar: "🗜️",
      "7z": "🗜️",
      txt: "📃",
    };
    return iconMap[ext || ""] || "📁";
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border p-4 transition cursor-pointer ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-500 bg-blue-500/10"
          : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
      } bg-neutral-50 dark:bg-neutral-800/30`}
    >
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <span className="text-3xl">{getFileIcon(file.originalFilename)}</span>
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
            {file.originalFilename}
          </p>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
            {formatFileSize(file.fileSize)} · {new Date(file.sharedAt).toLocaleDateString()}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            From: {file.sharedByEmail}
          </p>
        </div>

        <div className="shrink-0">
          <Share2Icon className="h-5 w-5 text-blue-500" />
        </div>
      </div>
    </div>
  );
}

// Shared File Card Component
function SharedFileCard({
  file,
  onClick,
  onDoubleClick,
  isSelected,
}: {
  file: SharedFile;
  onClick: () => void;
  onDoubleClick: () => void;
  isSelected?: boolean;
}) {
  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();

    const iconMap: Record<string, string> = {
      pdf: "📄",
      doc: "📝",
      docx: "📝",
      xls: "📊",
      xlsx: "📊",
      ppt: "📊",
      pptx: "📊",
      jpg: "🖼️",
      jpeg: "🖼️",
      png: "🖼️",
      gif: "🖼️",
      svg: "🖼️",
      mp4: "🎥",
      mov: "🎥",
      avi: "🎥",
      mp3: "🎵",
      wav: "🎵",
      zip: "🗜️",
      rar: "🗜️",
      "7z": "🗜️",
      txt: "📃",
    };

    return iconMap[ext || ""] || "📁";
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`rounded-xl overflow-hidden shadow-md border 
      ${isSelected ? "border-blue-500 ring-2 ring-blue-500" : "border-neutral-300 dark:border-neutral-700"}
      bg-white dark:bg-blue-900/20 
      hover:scale-[1.02] hover:shadow-lg transition cursor-pointer relative`}
    >
      {/* Shared indicator badge */}
      <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
        <Share2Icon className="h-3 w-3" />
        <span>Shared</span>
      </div>

      <div className="h-36 w-full bg-linear-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
        <span className="text-6xl">{getFileIcon(file.originalFilename)}</span>
      </div>

      <div className="p-4">
        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
          {file.originalFilename}
        </p>
        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
          {formatFileSize(file.fileSize)}
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 truncate">
          From: {file.sharedByEmail}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
          {new Date(file.sharedAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

// Shared By Me Card Component (List View)
function SharedByMeCard({ share }: { share: ShareRecord }) {
  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();

    const iconMap: Record<string, string> = {
      pdf: "📄",
      doc: "📝",
      docx: "📝",
      xls: "📊",
      xlsx: "📊",
      ppt: "📊",
      pptx: "📊",
      jpg: "🖼️",
      jpeg: "🖼️",
      png: "🖼️",
      gif: "🖼️",
      svg: "🖼️",
      mp4: "🎥",
      mov: "🎥",
      avi: "🎥",
      mp3: "🎵",
      wav: "🎵",
      zip: "🗜️",
      rar: "🗜️",
      "7z": "🗜️",
      txt: "📃",
    };

    return iconMap[ext || ""] || "📁";
  };

  return (
    <div className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <span className="text-3xl">{getFileIcon(share.originalFilename)}</span>
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
            {share.originalFilename}
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            Shared with: <span className="font-medium">{share.recipientEmail}</span>
          </p>
          {share.recipientName && (
            <p className="text-xs text-neutral-500 dark:text-neutral-500">
              {share.recipientName}
            </p>
          )}
          <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
            {new Date(share.sharedAt).toLocaleDateString()} at {new Date(share.sharedAt).toLocaleTimeString()}
          </p>
        </div>

        <div className="shrink-0">
          <Share2Icon className="h-5 w-5 text-blue-500" />
        </div>
      </div>
    </div>
  );
}

// Shared By Me Card Component (Grid View)
function SharedByMeCardGrid({ share }: { share: ShareRecord }) {
  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();

    const iconMap: Record<string, string> = {
      pdf: "📄",
      doc: "📝",
      docx: "📝",
      xls: "📊",
      xlsx: "📊",
      ppt: "📊",
      pptx: "📊",
      jpg: "🖼️",
      jpeg: "🖼️",
      png: "🖼️",
      gif: "🖼️",
      svg: "🖼️",
      mp4: "🎥",
      mov: "🎥",
      avi: "🎥",
      mp3: "🎵",
      wav: "🎵",
      zip: "🗜️",
      rar: "🗜️",
      "7z": "🗜️",
      txt: "📃",
    };

    return iconMap[ext || ""] || "📁";
  };

  return (
    <div className="rounded-xl overflow-hidden shadow-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-purple-900/20 hover:scale-[1.02] hover:shadow-lg transition">
      <div className="h-36 w-full bg-linear-to-br from-green-500/20 to-purple-500/20 flex items-center justify-center">
        <span className="text-6xl">{getFileIcon(share.originalFilename)}</span>
      </div>

      <div className="p-4">
        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
          {share.originalFilename}
        </p>
        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 truncate">
          To: {share.recipientEmail}
        </p>
        {share.recipientName && (
          <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1 truncate">
            {share.recipientName}
          </p>
        )}
        <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
          {new Date(share.sharedAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
