import { authClient } from "@/lib/auth-client";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import React from "react";
import { Button } from "@/components/ui/button";
import { filesApi, type FileMetadata } from "@/lib/files-api";
import { getFolders, deleteFolder, getFolderDetails, type Folder } from "@/lib/folders-api";
import { save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { FolderOpen, Filter, Grid3x3, List, MoreVertical, Plus, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { downloadAndDecryptSharedFile, unwrapSharedDek } from "@/lib/tauri-crypto";
import { FileSidebar } from "@/components/FileSidebar";
import { FolderSidebar } from "@/components/FolderSidebar";
import { ShareFolderDialog } from "@/components/ShareFolderDialog";
import { ShareFileDialog } from "@/components/ShareFileDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { ButtonGroup } from "@/components/ui/button-group";


import {
  File as FileIcon,
  FileImage,
  FileAudio,
  FileVideo,
  FileArchive,
  FileText,
  FileCode,
} from "lucide-react";

function getFileIcon(ext?: string) {
  if (!ext) return FileIcon;

  const mapping: Record<string, any> = {
    pdf: FileText,
    doc: FileText,
    docx: FileText,
    txt: FileText,
    jpg: FileImage,
    jpeg: FileImage,
    png: FileImage,
    gif: FileImage,
    svg: FileImage,
    mp3: FileAudio,
    wav: FileAudio,
    mp4: FileVideo,
    mov: FileVideo,
    avi: FileVideo,
    zip: FileArchive,
    rar: FileArchive,
    "7z": FileArchive,
    js: FileCode,
    ts: FileCode,
    json: FileCode,
  };

  return mapping[ext] || FileIcon;
}

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
  const [shareFolderDialogOpen, setShareFolderDialogOpen] = React.useState(false);
  const [folderToShare, setFolderToShare] = React.useState<Folder | null>(null);
  const [shareFileDialogOpen, setShareFileDialogOpen] = React.useState(false);
  const [fileToShare, setFileToShare] = React.useState<FileMetadata | null>(null);

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

  const handleDeleteFolder = async (folder: Folder) => {
    if (!confirm(`Are you sure you want to delete the folder "${folder.name}"? This will delete the folder and all files inside it.`)) {
      return;
    }

    const toastId = toast.loading(`Deleting folder ${folder.name}...`);

    try {
      setError(null);
      await deleteFolder(folder.folderId);
      setSelectedFolder(null);
      await loadData();

      toast.success("Folder deleted", {
        id: toastId,
        description: `${folder.name} has been deleted successfully.`,
      });
    } catch (err) {
      console.error("Delete folder error:", err);
      const errorMessage = err instanceof Error ? err.message : "Delete failed";
      setError(errorMessage);

      toast.error("Delete failed", {
        id: toastId,
        description: errorMessage,
      });
    }
  };

  const handleShareFolder = async (folder: Folder) => {
    setFolderToShare(folder);
    setShareFolderDialogOpen(true);
  };

  const handleShareFile = (file: FileMetadata) => {
    setFileToShare(file);
    setShareFileDialogOpen(true);
  };

  const handleDownloadFolder = async (folder: Folder) => {
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

      // Get folder details to fetch all files
      const toastId = toast.loading(`Preparing to download folder "${folder.name}"...`);
      
      const folderDetails = await getFolderDetails(folder.folderId);
      
      if (folderDetails.files.length === 0) {
        toast.info("Empty folder", {
          id: toastId,
          description: "This folder doesn't contain any files.",
        });
        return;
      }

      // Ask user to select a directory to save all files
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selectedDir = await open({
        directory: true,
        multiple: false,
        title: `Select folder to save files from "${folder.name}"`,
      });

      if (!selectedDir) {
        toast.dismiss(toastId);
        return;
      }

      const dirPath = typeof selectedDir === 'string' ? selectedDir : selectedDir[0];
      
      toast.loading(`Downloading ${folderDetails.files.length} file(s)...`, {
        id: toastId,
        description: `Saving to: ${dirPath}`,
      });

      let successCount = 0;
      let failedFiles: string[] = [];

      // Download each file
      for (const file of folderDetails.files) {
        try {
          // Get download info
          const downloadInfo = await filesApi.getDownloadInfo(file.fileId);

          // Unwrap the DEK using user's private key
          const dekBase64 = await unwrapSharedDek(
            downloadInfo.wrappedDek,
            userPublicKey,
            userPrivateKey
          );

          // Create the output path
          const outputPath = `${dirPath}/${file.originalFilename}`;

          // Download and decrypt the file
          await downloadAndDecryptSharedFile(
            downloadInfo.downloadUrl,
            dekBase64,
            downloadInfo.nonce,
            outputPath
          );

          successCount++;
          
          toast.loading(
            `Downloading ${folderDetails.files.length} file(s)... (${successCount}/${folderDetails.files.length})`,
            {
              id: toastId,
              description: `Saved: ${file.originalFilename}`,
            }
          );
        } catch (err) {
          console.error(`Failed to download ${file.originalFilename}:`, err);
          failedFiles.push(file.originalFilename);
        }
      }

      // Show final result
      if (failedFiles.length === 0) {
        toast.success("Folder downloaded successfully!", {
          id: toastId,
          description: `All ${successCount} file(s) saved to: ${dirPath}`,
        });
      } else {
        toast.warning("Folder downloaded with errors", {
          id: toastId,
          description: `${successCount} succeeded, ${failedFiles.length} failed: ${failedFiles.join(", ")}`,
        });
      }
    } catch (err) {
      console.error("Download folder error:", err);
      const errorMessage = err instanceof Error ? err.message : "Download failed";
      setError(errorMessage);
      toast.error("Download failed", {
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
    <main className="flex h-full overflow-hidden bg-white dark:bg-neutral-950">
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-neutral-950">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 text-neutral-900 dark:text-white">My Files and Folders</h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              All files and folders created and share with you will be displayed here
            </p>
          </div>
      
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

          <h2 className="text-2xl font-bold mb-4 text-neutral-900 dark:text-white">Folders</h2>


          
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
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-300 dark:border-red-500 rounded-lg text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Folders Grid */}
        <div className="mb-12">
          {loading ? (
            <div className="text-center py-12 text-neutral-600 dark:text-neutral-500">Loading folders...</div>
          ) : folders.length === 0 ? (
            <div className="text-center py-8 text-neutral-600 dark:text-neutral-500">
              No folders yet. Create one by uploading files!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {folders.map((folder) => (
                <FolderCard
                  key={folder.folderId}
                  folder={folder}
                  isSelected={selectedFolder?.folderId === folder.folderId}
                  onClick={() => {
                    setSelectedFile(null);
                    setSelectedFolder(folder);
                  }}
                  onDoubleClick={() =>
                    navigate({ to: `/dashboard/folders/${folder.folderId}` })
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Pinned Important Files Section */}
        <div>
          <h2 className="text-2xl font-bold mb-4 text-neutral-900 dark:text-white">Files</h2>

          {loading ? (
            <div className="text-center py-12 text-neutral-600 dark:text-neutral-500">Loading files...</div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-neutral-600 dark:text-neutral-500">
              No files yet. Upload your first file!
            </div>
          ) : viewMode === "list" ? (
            // LIST VIEW
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-300 dark:border-neutral-800">
                    <th className="text-left py-4 px-4 font-semibold text-neutral-700 dark:text-neutral-300 w-12">
                      <Checkbox />
                    </th>
                    <th className="text-left py-4 px-4 font-semibold text-neutral-700 dark:text-neutral-300">Name</th>
                    {/* <th className="text-left py-4 px-4 font-semibold text-neutral-700 dark:text-neutral-300">File Type</th> */}
                    <th className="text-left py-4 px-4 font-semibold text-neutral-700 dark:text-neutral-300">Owner</th>
                    <th className="text-left py-4 px-4 font-semibold text-neutral-700 dark:text-neutral-300">Date Modified</th>
                    <th className="text-left py-4 px-4 font-semibold text-neutral-700 dark:text-neutral-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr
                      key={file.id}
                      className={`border-b border-neutral-300 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900/50 transition cursor-pointer ${
                        selectedFile?.id === file.id ? "bg-purple-100 dark:bg-purple-600/20" : ""
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
                          <span className="text-neutral-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer">
                            {file.originalFilename}
                          </span>
                        </div>
                      </td>
                      {/* <td className="py-4 px-4 text-neutral-600 dark:text-neutral-400">
                        {file.mimeType || "File"}
                      </td> */}
                      <td className="py-4 px-4 text-neutral-600 dark:text-neutral-400">
                        {session.data?.user?.name || "Me"}
                      </td>
                      <td className="py-4 px-4 text-neutral-600 dark:text-neutral-400">
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
                              className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            >
                              Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-800 text-neutral-900 dark:text-white">
                            <DropdownMenuItem
                              onClick={() => handleDownload(file)}
                              className="hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                            >
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(file)}
                              className="hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
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
                <FileCard
                  key={file.id}
                  file={file}
                  isSelected={selectedFile?.id === file.id}
                  onClick={() => {
                    setSelectedFolder(null);
                    setSelectedFile(file);
                  }}
                  onDoubleClick={() =>
                    navigate({ to: `/dashboard/files/${file.id}` })
                  }
                />
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
          onShare={() => handleShareFile(selectedFile)}
          ownerName={session.data?.user?.name || session.data?.user?.email || "Unknown"}
          showShareButton={true}
          isSharedFile={false}
        />
      )}

      {/* Folder Sidebar */}
      {selectedFolder && (
        <FolderSidebar
          folder={selectedFolder}
          onClose={() => setSelectedFolder(null)}
          onOpenFolder={() => navigate({ to: `/dashboard/folders/${selectedFolder.folderId}` })}
          onDelete={() => handleDeleteFolder(selectedFolder)}
          onShare={() => handleShareFolder(selectedFolder)}
          onDownload={() => handleDownloadFolder(selectedFolder)}
        />
      )}

      {/* Share Folder Dialog */}
      {folderToShare && (
        <ShareFolderDialog
          open={shareFolderDialogOpen}
          onOpenChange={setShareFolderDialogOpen}
          folderId={folderToShare.folderId}
          folderName={folderToShare.name}
          wrappedFolderKey={folderToShare.wrappedFolderKey}
          onShareComplete={() => {
            loadData();
            setShareFolderDialogOpen(false);
          }}
        />
      )}

      {/* Share File Dialog */}
      {fileToShare && (
        <ShareFileDialog
          open={shareFileDialogOpen}
          onOpenChange={setShareFileDialogOpen}
          fileId={fileToShare.id}
          fileName={fileToShare.originalFilename}
          wrappedDek={fileToShare.wrappedDek || ""}
          onShareComplete={() => {
            loadData();
            setShareFileDialogOpen(false);
          }}
        />
      )}
    </main>
  );
}

function FileCard({
  file,
  onClick,
  onDoubleClick,
  isSelected,
}: {
  file: FileMetadata;
  onClick: () => void;
  onDoubleClick: () => void;
  isSelected?: boolean;
}) {
  const ext = file.originalFilename.split(".").pop()?.toLowerCase();
  const Icon = getFileIcon(ext);

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`
        group w-full flex items-center gap-4 rounded-2xl p-4 cursor-pointer
        backdrop-blur-xl transition-all border
        bg-white/60 dark:bg-purple-200/10
        shadow-[0_2px_10px_rgba(0,0,0,0.15)]
        hover:shadow-[0_4px_22px_rgba(168,85,247,0.35)]
        hover:scale-[1.01]

        ${isSelected
          ? "border-purple-500/70 ring-2 ring-purple-400"
          : "border-white/20 dark:border-white/10"}
      `}
    >
      {/* ICON */}
      <div className="flex items-center justify-center">
        <Icon className="w-10 h-10 text-purple-300 group-hover:text-purple-300 transition" />
      </div>

      {/* FILE TEXT INFO */}
      <div className="flex flex-col min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
          {file.originalFilename}
        </p>

        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
          {formatFileSize(file.fileSize)} • {ext?.toUpperCase() || "FILE"}
        </p>

        <p className="text-xs text-slate-500 dark:text-slate-500">
          {new Date(file.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* RIGHT-SIDE ARROW*/}
      <div className="ml-auto opacity-0 group-hover:opacity-100 transition">
        <svg
          className="h-4 w-4 text-purple-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

function FolderCard({
  folder,
  onClick,
  onDoubleClick,
  isSelected,
}: {
  folder: Folder;
  onClick: () => void;
  onDoubleClick: () => void;
  isSelected?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`
        group w-full flex items-center gap-4 rounded-2xl p-4 cursor-pointer
        backdrop-blur-xl transition-all border
        bg-white/60 dark:bg-purple-400/20
        shadow-[0_2px_10px_rgba(0,0,0,0.15)]
        hover:shadow-[0_4px_22px_rgba(168,85,247,0.35)]
        hover:scale-[1.01]

        ${isSelected
          ? "border-purple-500/70 ring-2 ring-purple-400"
          : "border-white/20 dark:border-white/10"}
      `}
    >
      {/* ICON */}
      <div className="flex items-center justify-center">
        <FolderOpen className="w-10 h-10 text-purple-300 group-hover:text-purple-300 transition" />
      </div>

      {/* FOLDER INFO */}
      <div className="flex flex-col min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
          {folder.name}
        </p>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Folder
        </p>
      </div>

      {/* RIGHT-SIDE ARROW */}
      <div className="ml-auto opacity-0 group-hover:opacity-100 transition">
        <svg
          className="h-4 w-4 text-purple-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "0 Bytes";
  const units = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(2);
  return `${size} ${units[i]}`;
}
