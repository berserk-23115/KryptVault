import { authClient } from "@/lib/auth-client";
import { createFileRoute, redirect, useSearch, useNavigate } from "@tanstack/react-router";
import React from "react";
import { Button } from "@/components/ui/button";
import { filesApi, type FileMetadata } from "@/lib/files-api";
import { getFolders, type Folder } from "@/lib/folders-api";
import { toast } from "sonner";
import { ArrowLeft, Grid3x3, List } from "lucide-react";
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
  FolderOpen,
} from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { downloadAndDecryptSharedFile, unwrapSharedDek } from "@/lib/tauri-crypto";

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

interface SearchContext {
  query?: string;
}

export const Route = createFileRoute("/dashboard/search")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({ to: "/login", throw: true });
    }
    return { session };
  },
  validateSearch: (search: Record<string, unknown>): SearchContext => {
    return {
      query: (search.query as string) || (search.q as string),
    };
  },
});

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const { query = "" } = useSearch({ from: Route.id });
  const navigate = useNavigate();

  const [allFiles, setAllFiles] = React.useState<FileMetadata[]>([]);
  const [allFolders, setAllFolders] = React.useState<Folder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<FileMetadata | null>(null);
  const [selectedFolder, setSelectedFolder] = React.useState<Folder | null>(null);
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
  const [shareFolderDialogOpen, setShareFolderDialogOpen] = React.useState(false);
  const [folderToShare, setFolderToShare] = React.useState<Folder | null>(null);
  const [shareFileDialogOpen, setShareFileDialogOpen] = React.useState(false);
  const [fileToShare, setFileToShare] = React.useState<FileMetadata | null>(null);

  // Load all files and folders on mount
  React.useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [filesList, foldersList] = await Promise.all([
          filesApi.listFiles(),
          getFolders(),
        ]);

        const normalizedFiles = filesList.map((file) => ({
          ...file,
          id: file.fileId || file.id,
        }));

        setAllFiles(normalizedFiles);
        setAllFolders(foldersList);
      } catch (err) {
        console.error("Failed to load data:", err);
        setError(err instanceof Error ? err.message : "Failed to load files and folders");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter files and folders based on query
  const normalizedQuery = query.toLowerCase().trim();
  const filteredFiles = normalizedQuery
    ? allFiles.filter((file) =>
        file.originalFilename.toLowerCase().includes(normalizedQuery)
      )
    : allFiles;

  const filteredFolders = normalizedQuery
    ? allFolders.filter((folder) =>
        folder.name.toLowerCase().includes(normalizedQuery)
      )
    : allFolders;

  const handleDownload = async (file: FileMetadata) => {
    let toastId: string | number | undefined;

    try {
      setError(null);

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

      const savePath = await save({
        title: "Save decrypted file",
        defaultPath: file.originalFilename,
      });

      if (!savePath) return;

      toastId = toast.loading(`Downloading ${file.originalFilename}...`, {
        description: "Fetching download URL...",
      });

      const downloadInfo = await filesApi.getDownloadInfo(file.id);

      toast.loading(`Downloading ${file.originalFilename}...`, {
        id: toastId,
        description: "Unwrapping encryption key...",
      });

      const dekBase64 = await unwrapSharedDek(
        downloadInfo.wrappedDek,
        userPublicKey,
        userPrivateKey
      );

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

      // Update filtered lists
      setAllFiles((prev) => prev.filter((f) => f.id !== file.id));
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

  const handleShareFile = (file: FileMetadata) => {
    setFileToShare(file);
    setShareFileDialogOpen(true);
  };

  const handleShareFolder = (folder: Folder) => {
    setFolderToShare(folder);
    setShareFolderDialogOpen(true);
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

  const totalResults = filteredFiles.length + filteredFolders.length;

  return (
    <main className="flex h-full overflow-hidden bg-white dark:bg-neutral-950">
      <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-neutral-950">
        {/* Header with back button */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/dashboard" })}
              className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold text-neutral-900 dark:text-white">
                Search Results
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 mt-1">
                {query ? (
                  <>
                    Found {totalResults} result{totalResults !== 1 ? "s" : ""} for "{query}"
                  </>
                ) : (
                  "Enter a search query to get started"
                )}
              </p>
            </div>
          </div>

          <ButtonGroup>
            <Button
              onClick={() => setViewMode("list")}
              variant={viewMode === "list" ? "default" : "outline"}
              className={`gap-2 ${
                viewMode === "list"
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-neutral-100 dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800"
              }`}
            >
              <List className="h-4 w-4" />
              List
            </Button>
            <Button
              onClick={() => setViewMode("grid")}
              variant={viewMode === "grid" ? "default" : "outline"}
              className={`gap-2 ${
                viewMode === "grid"
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-neutral-100 dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800"
              }`}
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

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12 text-neutral-600 dark:text-neutral-500">
            Loading results...
          </div>
        )}

        {/* No Query State */}
        {!loading && !query && (
          <div className="text-center py-12 text-neutral-600 dark:text-neutral-500">
            <p className="text-lg">Use the search bar to find files and folders</p>
          </div>
        )}

        {/* No Results State */}
        {!loading && query && totalResults === 0 && (
          <div className="text-center py-12 text-neutral-600 dark:text-neutral-500">
            <p className="text-lg mb-2">No results found for "{query}"</p>
            <p className="text-sm">Try searching with different keywords</p>
          </div>
        )}

        {/* Results */}
        {!loading && query && totalResults > 0 && (
          <>
            {/* Folders Section */}
            {filteredFolders.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4 text-neutral-900 dark:text-white">
                  Folders ({filteredFolders.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredFolders.map((folder) => (
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
              </div>
            )}

            {/* Files Section */}
            {filteredFiles.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4 text-neutral-900 dark:text-white">
                  Files ({filteredFiles.length})
                </h2>
                {viewMode === "list" ? (
                  // LIST VIEW
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-neutral-300 dark:border-neutral-800">
                          <th className="text-left py-4 px-4 font-semibold text-neutral-700 dark:text-neutral-300">
                            Name
                          </th>
                          <th className="text-left py-4 px-4 font-semibold text-neutral-700 dark:text-neutral-300">
                            Size
                          </th>
                          <th className="text-left py-4 px-4 font-semibold text-neutral-700 dark:text-neutral-300">
                            Date
                          </th>
                          <th className="text-left py-4 px-4 font-semibold text-neutral-700 dark:text-neutral-300">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFiles.map((file) => (
                          <tr
                            key={file.id}
                            className={`border-b border-neutral-300 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900/50 transition cursor-pointer ${
                              selectedFile?.id === file.id
                                ? "bg-purple-100 dark:bg-purple-600/20"
                                : ""
                            }`}
                            onClick={() => {
                              setSelectedFolder(null);
                              setSelectedFile(file);
                            }}
                          >
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{getFileIcon(file.originalFilename)}</span>
                                <span className="text-neutral-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer">
                                  {file.originalFilename}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-neutral-600 dark:text-neutral-400">
                              {formatFileSize(file.fileSize)}
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
                                    onClick={() => handleShareFile(file)}
                                    className="hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                                  >
                                    Share
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
                    {filteredFiles.map((file) => (
                      <FileCard
                        key={file.id}
                        file={file}
                        isSelected={selectedFile?.id === file.id}
                        onClick={() => {
                          setSelectedFolder(null);
                          setSelectedFile(file);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Right Sidebar for File */}
      {selectedFile && (
        <FileSidebar
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onPreview={() => handleDownload(selectedFile)}
          onDownload={() => handleDownload(selectedFile)}
          onDelete={() => handleDelete(selectedFile)}
          onShare={() => handleShareFile(selectedFile)}
          ownerName={selectedFile.ownerName || selectedFile.ownerEmail || "Unknown"}
          showShareButton={true}
          isSharedFile={selectedFile.isOwner === false}
        />
      )}

      {/* Right Sidebar for Folder */}
      {selectedFolder && (
        <FolderSidebar
          folder={selectedFolder}
          onClose={() => setSelectedFolder(null)}
          onOpenFolder={() =>
            navigate({ to: `/dashboard/folders/${selectedFolder.folderId}` })
          }
          onDelete={() => {
            // Handle delete - for now just close
            setSelectedFolder(null);
          }}
          onShare={() => handleShareFolder(selectedFolder)}
          onDownload={() => {
            // Handle download - for now just close
            setSelectedFolder(null);
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
          currentUserId={session.data?.user?.id}
          onShareComplete={() => {
            setShareFileDialogOpen(false);
          }}
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
            setShareFolderDialogOpen(false);
          }}
        />
      )}
    </main>
  );
}

function FileCard({
  file,
  onClick,
  isSelected,
}: {
  file: FileMetadata;
  onClick: () => void;
  isSelected?: boolean;
}) {
  const ext = file.originalFilename.split(".").pop()?.toLowerCase();
  const Icon = getFileIcon(ext);

  return (
    <div
      onClick={onClick}
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
      <div className="flex items-center justify-center">
        <Icon className="w-10 h-10 text-purple-300 group-hover:text-purple-300 transition" />
      </div>

      <div className="flex flex-col min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
          {file.originalFilename}
        </p>

        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
          {formatFileSize(file.fileSize)}
        </p>

        <p className="text-xs text-slate-500 dark:text-slate-500">
          {new Date(file.createdAt).toLocaleDateString()}
        </p>
      </div>

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

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }
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
      <div className="flex items-center justify-center">
        <FolderOpen className="w-10 h-10 text-purple-300 group-hover:text-purple-300 transition" />
      </div>

      <div className="flex flex-col min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
          {folder.name}
        </p>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Folder
        </p>
      </div>

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
