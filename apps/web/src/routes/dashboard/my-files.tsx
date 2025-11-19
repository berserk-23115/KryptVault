import { authClient } from "@/lib/auth-client";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import React from "react";
import { Button } from "@/components/ui/button";
import { filesApi, type FileMetadata } from "@/lib/files-api";
import { getFolders, type Folder } from "@/lib/folders-api";
import { save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { FolderOpen, Filter, Grid3x3, List, MoreVertical, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { downloadAndDecryptSharedFile, unwrapSharedDek } from "@/lib/tauri-crypto";
import { FileSidebar } from "@/components/FileSidebar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { ButtonGroup } from "@/components/ui/button-group";
import { FileIcon, UserIcon } from "lucide-react";

export const Route = createFileRoute("/dashboard/my-files")({
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
  const navigate = useNavigate();
  const [folders, setFolders] = React.useState<Folder[]>([]);
  const [files, setFiles] = React.useState<FileMetadata[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = React.useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = React.useState<FileMetadata | null>(null);
  const [selectedFolder, setSelectedFolder] = React.useState<Folder | null>(null);
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load folders and files in parallel
      const [foldersList, filesList] = await Promise.all([
        getFolders(),
        filesApi.listFiles(),
      ]);

      setFolders(foldersList);

      // Normalize files
      const normalizedFiles = filesList.map((file) => ({
        ...file,
        id: file.fileId || file.id,
      }));
      setFiles(normalizedFiles);
    } catch (err) {
      console.error("Failed to load data:", err);
      setError(err instanceof Error ? err.message : "Failed to load files and folders");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

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

  const handleDelete = async (file: FileMetadata) => {
    if (!confirm(`Are you sure you want to delete "${file.originalFilename}"?`)) {
      return;
    }

    const toastId = toast.loading(`Deleting ${file.originalFilename}...`);

    try {
      setError(null);
      await filesApi.deleteFile(file.id);
      await loadData();

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

  const toggleFileSelection = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const getFileIcon = (filename: string): string => {
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
    <main className="flex h-full overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 text-neutral-900 dark:text-white">My Files and Folders</h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              All files and folders created and share with you will be displayed here
            </p>
          </div>
          <Button className="bg-neutral-800 hover:bg-neutral-700 gap-2">
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>

        {/* Filters */}
        <div className="mb-0 flex gap-2">
          {/* <Button 
            variant="outline" 
            className="bg-neutral-900 border-neutral-700 text-white hover:bg-neutral-800 gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button> */}

          <h2 className="text-2xl font-bold mb-4">Folders</h2>


          
          <ButtonGroup className="ml-auto">
            <Button
              onClick={() => setViewMode("list")}
              variant={viewMode === "list" ? "default" : "outline"}
              className={`gap-2 ${viewMode === "list" ? "bg-purple-600 hover:bg-purple-700" : "bg-neutral-100 dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800"}`}
            >
              <List className="h-4 w-4" />
              List
            </Button>
            <Button
              onClick={() => setViewMode("grid")}
              variant={viewMode === "grid" ? "default" : "outline"}
              className={`gap-2 ${viewMode === "grid" ? "bg-purple-600 hover:bg-purple-700" : "bg-neutral-100 dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800"}`}
            >
              <Grid3x3 className="h-4 w-4" />
              Grid
            </Button>
          </ButtonGroup>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Folders Grid */}
        <div className="mb-12">
          {loading ? (
            <div className="text-center py-12 text-neutral-500">Loading folders...</div>
          ) : folders.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              No folders yet. Create one by uploading files!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {folders.map((folder) => (
                <div
                  key={folder.folderId}
                  onClick={() => {
                    setSelectedFile(null); // Clear file selection
                    setSelectedFolder(folder);
                  }}
                  onDoubleClick={() => navigate({ to: `/dashboard/folders/${folder.folderId}` })}
                  className="bg-neutral-100 dark:bg-neutral-900 rounded-lg p-4 border border-neutral-300 dark:border-neutral-800 hover:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-800/50 transition cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-12 h-12 bg-linear-to-br from-purple-200 to-purple-400 dark:from-purple-600 dark:to-purple-800 rounded flex items-center justify-center">
                        <FolderOpen className="h-6 w-6 text-neutral-900 dark:text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-neutral-900 dark:text-white truncate">{folder.name}</h3>
                        {/* <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">{folder.ownerName}</p> */}
                      </div>
                    </div>
                    <button className="opacity-0 group-hover:opacity-100 transition">
                      <MoreVertical className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pinned Important Files Section */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Files</h2>

          {loading ? (
            <div className="text-center py-12 text-neutral-500">Loading files...</div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              No files yet. Upload your first file!
            </div>
          ) : viewMode === "list" ? (
            // LIST VIEW
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-800">
                    <th className="text-left py-4 px-4 font-semibold text-neutral-300 w-12">
                      <Checkbox />
                    </th>
                    <th className="text-left py-4 px-4 font-semibold text-neutral-300">Name</th>
                    <th className="text-left py-4 px-4 font-semibold text-neutral-300">File Type</th>
                    <th className="text-left py-4 px-4 font-semibold text-neutral-300">Owner</th>
                    <th className="text-left py-4 px-4 font-semibold text-neutral-300">Date Modified</th>
                    <th className="text-left py-4 px-4 font-semibold text-neutral-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr
                      key={file.id}
                      className={`border-b border-neutral-800 hover:bg-neutral-900/50 transition cursor-pointer ${
                        selectedFile?.id === file.id ? "bg-purple-600/20" : ""
                      }`}
                      onClick={() => {
                        setSelectedFolder(null); // Clear folder selection
                        setSelectedFile(file);
                      }}
                    >
                      <td className="py-4 px-4">
                        <Checkbox
                          checked={selectedFile?.id === file.id}
                          onCheckedChange={() => setSelectedFile(selectedFile?.id === file.id ? null : file)}
                        />
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{getFileIcon(file.originalFilename)}</span>
                          <span className="text-white hover:text-purple-400 cursor-pointer">
                            {file.originalFilename}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-neutral-400">
                        {file.mimeType || "File"}
                      </td>
                      <td className="py-4 px-4 text-neutral-400">
                        {session.data?.user?.name || "Me"}
                      </td>
                      <td className="py-4 px-4 text-neutral-400">
                        {new Date(file.createdAt).toLocaleDateString("en-US", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-4 px-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-purple-400 hover:text-purple-300 hover:bg-neutral-800"
                            >
                              Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-neutral-900 border-neutral-800 text-white">
                            <DropdownMenuItem
                              onClick={() => handleDownload(file)}
                              className="hover:bg-neutral-800 cursor-pointer"
                            >
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(file)}
                              className="hover:bg-red-900/20 cursor-pointer text-red-400 hover:text-red-300"
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            // GRID VIEW
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {files.map((file) => (
                <div
                  key={file.id}
                  onClick={() => {
                    setSelectedFolder(null); // Clear folder selection
                    setSelectedFile(file);
                  }}
                  className={`rounded-xl overflow-hidden shadow-md border 
                  ${selectedFile?.id === file.id ? "border-purple-500 ring-2 ring-purple-500" : "border-neutral-300 dark:border-neutral-700"}
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
                      {new Date(file.createdAt).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      {selectedFile && (
        <FileSidebar
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onPreview={() => handleDownload(selectedFile)}
          onDownload={() => handleDownload(selectedFile)}
          onDelete={() => handleDelete(selectedFile)}
          onShare={() => {
            // Share functionality
          }}
          ownerName={session.data?.user?.name || session.data?.user?.email || "Unknown"}
          showShareButton={false}
          isSharedFile={false}
        />
      )}

      {/* Folder Sidebar */}
      {selectedFolder && (
        <FolderSidebar
          folder={selectedFolder}
          onClose={() => setSelectedFolder(null)}
          onOpenFolder={() => navigate({ to: `/dashboard/folders/${selectedFolder.folderId}` })}
        />
      )}
    </main>
  );
}

// Folder Sidebar Component
function FolderSidebar({
  folder,
  onClose,
  onOpenFolder,
}: {
  folder: Folder;
  onClose: () => void;
  onOpenFolder: () => void;
}) {
  return (
    <aside className="w-96 border-l border-border bg-card flex flex-col overflow-y-auto">
      <div className="p-6 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FolderOpen className="h-5 w-5 shrink-0" />
            <h2 className="text-lg font-semibold truncate">
              {folder.name}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="shrink-0"
          >
            <span className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white">✕</span>
          </Button>
        </div>

        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
          Folder details and options
        </p>

        {/* Folder Icon Preview */}
        <div className="aspect-video bg-linear-to-br from-purple-200 to-purple-400 dark:from-purple-600 dark:to-purple-800 rounded-lg flex items-center justify-center mb-6">
          <FolderOpen className="h-16 w-16 text-neutral-900 dark:text-white" />
        </div>

        {/* Folder Info - Scrollable */}
        <div className="space-y-4 mb-6 flex-1 overflow-y-auto">
          <div>
            <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-1">
              <FolderOpen className="h-4 w-4" />
              <span>Folder Name</span>
            </div>
            <p className="text-lg font-medium text-neutral-900 dark:text-white">
              {folder.name}
            </p>
          </div>

          <Separator />

          <div>
            <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-1">
              <UserIcon className="h-4 w-4" />
              <span>Owner</span>
            </div>
            <p className="text-lg font-medium text-neutral-900 dark:text-white">
              {folder.ownerName}
            </p>
          </div>

          <Separator />

          <div>
            <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-1">
              <FileIcon className="h-4 w-4" />
              <span>Folder ID</span>
            </div>
            <p className="text-sm font-mono text-neutral-900 dark:text-white break-all bg-neutral-100 dark:bg-neutral-800 p-2 rounded mt-1">
              {folder.folderId}
            </p>
          </div>
        </div>

        {/* Actions - Fixed at Bottom */}
        <div className="space-y-2 pt-6 border-t border-border">
          <Button
            onClick={onOpenFolder}
            className="w-full"
            variant="default"
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Open Folder
          </Button>
        </div>
      </div>
    </aside>
  );
}
