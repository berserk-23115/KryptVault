import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileIcon, Share2Icon, Grid3x3, List, FolderOpen } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  getSharedWithMe,
  getSharedByMe,
  type SharedFile,
  type ShareRecord,
} from "@/lib/sharing-api";
import {
  getSharedWithMeFolders,
  getSharedByMeFolders,
  getFolderDetails,
  type SharedFolder,
  type SharedFolderRecord,
} from "@/lib/folders-api";
import {
  downloadAndDecryptSharedFile,
  unwrapSharedDek,
} from "@/lib/tauri-crypto";
import { save } from "@tauri-apps/plugin-dialog";
import { FileSidebar } from "@/components/FileSidebar";
import { FolderSidebar } from "@/components/FolderSidebar";
import { filesApi, type FileMetadata } from "@/lib/files-api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card } from "@/components/ui/card";
import type { Folder } from "@/lib/folders-api";

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
  const navigate = useNavigate();
  const [sharedWithMeFiles, setSharedWithMeFiles] = React.useState<
    SharedFile[]
  >([]);
  const [sharedByMeRecords, setSharedByMeRecords] = React.useState<
    ShareRecord[]
  >([]);
  const [sharedWithMeFolders, setSharedWithMeFolders] = React.useState<
    SharedFolder[]
  >([]);
  const [sharedByMeFolderRecords, setSharedByMeFolderRecords] = React.useState<
    SharedFolderRecord[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedFile, setSelectedFile] = React.useState<SharedFile | null>(
    null
  );
  const [selectedFolder, setSelectedFolder] =
    React.useState<SharedFolder | null>(null);
  // State for "Shared By Me" tab selections
  const [selectedSharedByMeFile, setSelectedSharedByMeFile] = React.useState<ShareRecord | null>(null);
  const [selectedSharedByMeFolder, setSelectedSharedByMeFolder] = React.useState<SharedFolderRecord | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");

  const loadSharedFiles = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load shared with me files (backend already filters out self-shares)
      const filesSharedWithMe = await getSharedWithMe();
      setSharedWithMeFiles(filesSharedWithMe);

      // Load shared by me records (backend already filters out self-shares)
      const filesSharedByMe = await getSharedByMe();
      setSharedByMeRecords(filesSharedByMe);

      // Load shared folders
      const foldersSharedWithMe = await getSharedWithMeFolders();
      setSharedWithMeFolders(foldersSharedWithMe);

      const foldersSharedByMe = await getSharedByMeFolders();
      setSharedByMeFolderRecords(foldersSharedByMe);
    } catch (err) {
      console.error("Failed to load shared files:", err);
      const errorMsg =
        err instanceof Error ? err.message : "Failed to load shared files";
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
    setSelectedFolder(null); // Clear folder selection when selecting a file
    setSelectedSharedByMeFile(null);
    setSelectedSharedByMeFolder(null);
  };

  const handleFolderClick = (folder: SharedFolder) => {
    setSelectedFolder(folder);
    setSelectedFile(null); // Clear file selection when selecting a folder
    setSelectedSharedByMeFile(null);
    setSelectedSharedByMeFolder(null);
  };

  const handleSharedByMeFileClick = (shareRecord: ShareRecord) => {
    setSelectedSharedByMeFile(shareRecord);
    setSelectedFile(null);
    setSelectedFolder(null);
    setSelectedSharedByMeFolder(null);
  };

  const handleSharedByMeFolderClick = (shareRecord: SharedFolderRecord) => {
    setSelectedSharedByMeFolder(shareRecord);
    setSelectedFile(null);
    setSelectedFolder(null);
    setSelectedSharedByMeFile(null);
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
      const userPublicKey =
        userKeys.x25519PublicKey || userKeys.x25519_public_key;
      const userPrivateKey =
        userKeys.x25519PrivateKey || userKeys.x25519_private_key;

      if (!userPublicKey || !userPrivateKey) {
        toast.error(
          "Invalid keypair data. Please regenerate your encryption keys."
        );
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
      const errorMessage =
        err instanceof Error ? err.message : "Download failed";
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

  const handleDownloadFolder = async (folder: SharedFolder) => {
    try {
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
      toast.error("Download failed", {
        description: errorMessage,
      });
    }
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

  // Convert ShareRecord to FileMetadata for "Shared By Me" sidebar
  const convertShareRecordToFileMetadata = (share: ShareRecord): FileMetadata => {
    return {
      id: share.fileId,
      fileId: share.fileId,
      originalFilename: share.originalFilename,
      mimeType: undefined,
      fileSize: 0, // Not available in ShareRecord
      createdAt: share.sharedAt,
      updatedAt: share.sharedAt,
      userId: session.data?.user?.id || "",
      s3Key: "",
      s3Bucket: "",
      nonce: "",
      wrappedDek: "",
      description: undefined,
      tags: undefined,
      folderId: undefined,
      isOwner: true, // User is the owner for "Shared By Me"
    };
  };

  // Convert SharedFolderRecord to Folder for "Shared By Me" sidebar
  const convertSharedFolderRecordToFolder = (share: SharedFolderRecord): Folder => {
    return {
      folderId: share.folderId,
      name: share.folderName,
      description: null,
      parentFolderId: null,
      ownerId: session.data?.user?.id || "",
      ownerName: session.data?.user?.name || "",
      wrappedFolderKey: "",
      createdAt: share.sharedAt,
    };
  };

  return (
    <main className="flex h-full overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 text-neutral-900 dark:text-white">
              Shared
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              All shared files and folders will be displayed here
            </p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500 dark:text-red-400">
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
            {/* Folders Section */}
            {sharedWithMeFolders.length > 0 && (
              <section>
                <div className="mb-0 flex gap-2">
                  {/* <Button 
                            variant="outline" 
                            className="bg-neutral-900 border-neutral-700 text-white hover:bg-neutral-800 gap-2"
                          >
                            <Filter className="h-4 w-4" />
                            Filters
                          </Button> */}

                  <h2 className="text-2xl font-bold mb-4 text-neutral-900 dark:text-white">
                    Folders
                  </h2>

                  <ButtonGroup className="ml-auto">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
                  {sharedWithMeFolders.map((folder) => (
                    <div
                      key={folder.folderId}
                      onClick={() => handleFolderClick(folder)}
                      onDoubleClick={() =>
                        navigate({
                          to: `/dashboard/folders/${folder.folderId}`,
                        })
                      }
                      className="bg-neutral-100 dark:bg-neutral-900 rounded-lg p-4 border border-neutral-300 dark:border-neutral-800 hover:border-purple-400 dark:hover:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-800/50 transition cursor-pointer group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-12 h-12 bg-linear-to-br from-purple-200 to-purple-400 dark:from-purple-600 dark:to-purple-800 rounded flex items-center justify-center">
                            <FolderOpen className="h-6 w-6 text-purple-800 dark:text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-neutral-900 dark:text-white truncate">
                              {folder.name}
                            </h3>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                              Shared by {folder.ownerName}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Files Section */}
            <section>
              <h2 className="text-2xl font-bold mb-4">Files</h2>

              {loading ? (
                <div className="text-center py-12 text-neutral-500">
                  Loading files...
                </div>
              ) : sharedWithMeFiles.length === 0 &&
                sharedWithMeFolders.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  <Share2Icon className="h-16 w-16 text-neutral-400 mx-auto mb-4" />
                  <p className="text-neutral-500 mb-2">
                    No files or folders shared with you yet
                  </p>
                  <p className="text-sm text-neutral-400">
                    When someone shares content with you, it will appear here
                  </p>
                </div>
              ) : sharedWithMeFiles.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  No files shared with you
                </div>
              ) : viewMode === "list" ? (
                // LIST VIEW
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-300 dark:border-neutral-800">
                        <th className="text-left py-4 px-4 font-semibold text-neutral-700 dark:text-neutral-300">
                          Name
                        </th>
                        <th className="text-left py-4 px-4 font-semibold text-neutral-700 dark:text-neutral-300">
                          Shared By
                        </th>
                        <th className="text-left py-4 px-4 font-semibold text-neutral-700 dark:text-neutral-300">
                          Date Shared
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sharedWithMeFiles.map((file) => (
                        <tr
                          key={file.fileId}
                          className={`border-b border-neutral-300 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900/50 transition cursor-pointer ${
                            selectedFile?.fileId === file.fileId
                              ? "bg-purple-100 dark:bg-purple-600/20"
                              : ""
                          }`}
                          onClick={() => handleFileClick(file)}
                          onDoubleClick={() => handleFileDoubleClick(file)}
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">
                                {getFileIcon(file.originalFilename)}
                              </span>
                              <span className="text-neutral-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer">
                                {file.originalFilename}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-neutral-600 dark:text-neutral-400">
                            {file.sharedByEmail}
                          </td>
                          <td className="py-4 px-4 text-neutral-600 dark:text-neutral-400">
                            {new Date(file.sharedAt).toLocaleDateString(
                              "en-US",
                              {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              }
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                // GRID VIEW
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  {sharedWithMeFiles.map((file) => (
                    <div
                      key={file.fileId}
                      onClick={() => handleFileClick(file)}
                      onDoubleClick={() => handleFileDoubleClick(file)}
                      className={`rounded-xl overflow-hidden shadow-md border 
                      ${
                        selectedFile?.fileId === file.fileId
                          ? "border-purple-500 ring-2 ring-purple-500"
                          : "border-neutral-300 dark:border-neutral-700"
                      }
                      bg-white dark:bg-purple-900/20 
                      hover:scale-[1.02] hover:shadow-lg transition cursor-pointer`}
                    >
                      <div className="h-36 w-full bg-linear-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                        <span className="text-6xl">
                          {getFileIcon(file.originalFilename)}
                        </span>
                      </div>

                      <div className="p-4">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                          {file.originalFilename}
                        </p>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                          {formatFileSize(file.fileSize)}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                          Shared by {file.sharedByEmail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </TabsContent>

          {/* Shared By Me Tab */}
          <TabsContent value="shared-by-me" className="space-y-4">
            {/* Folders Section */}
            {sharedByMeFolderRecords.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-4">
                  Folders Shared By Me
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
                  {sharedByMeFolderRecords.map((share) => (
                    <div
                      key={`${share.folderId}-${share.recipientUserId}`}
                      onClick={() => handleSharedByMeFolderClick(share)}
                      className={`bg-neutral-100 dark:bg-neutral-900 rounded-lg p-4 border ${
                        selectedSharedByMeFolder?.folderId === share.folderId &&
                        selectedSharedByMeFolder?.recipientUserId === share.recipientUserId
                          ? "border-purple-500 ring-2 ring-purple-500"
                          : "border-neutral-300 dark:border-neutral-800"
                      } hover:border-purple-400 dark:hover:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-800/50 transition cursor-pointer group`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-12 h-12 bg-linear-to-br from-purple-200 to-purple-400 dark:from-purple-600 dark:to-purple-800 rounded flex items-center justify-center">
                            <FolderOpen className="h-6 w-6 text-purple-800 dark:text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-neutral-900 dark:text-white truncate">
                              {share.folderName}
                            </h3>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                              Shared with {share.recipientName}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Files Section */}
            <section>
              <h2 className="text-2xl font-bold mb-4">Files Shared By Me</h2>

              {loading ? (
                <div className="text-center py-12 text-neutral-500">
                  Loading files...
                </div>
              ) : sharedByMeRecords.length === 0 &&
                sharedByMeFolderRecords.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  <Share2Icon className="h-16 w-16 text-neutral-400 mx-auto mb-4" />
                  <p className="text-neutral-500 mb-2">
                    You haven't shared any content yet
                  </p>
                  <p className="text-sm text-neutral-400">
                    When you share files or folders with someone, they will
                    appear here
                  </p>
                </div>
              ) : sharedByMeRecords.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  No files shared by you
                </div>
              ) : viewMode === "list" ? (
                // LIST VIEW
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-300 dark:border-neutral-800">
                        <th className="text-left py-4 px-4 font-semibold text-neutral-700 dark:text-neutral-300">
                          File Name
                        </th>
                        <th className="text-left py-4 px-4 font-semibold text-neutral-700 dark:text-neutral-300">
                          Shared With
                        </th>
                        <th className="text-left py-4 px-4 font-semibold text-neutral-700 dark:text-neutral-300">
                          Date Shared
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sharedByMeRecords.map((share) => (
                        <tr
                          key={`${share.fileId}-${share.recipientUserId}`}
                          onClick={() => handleSharedByMeFileClick(share)}
                          className={`border-b border-neutral-300 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900/50 transition cursor-pointer ${
                            selectedSharedByMeFile?.fileId === share.fileId &&
                            selectedSharedByMeFile?.recipientUserId === share.recipientUserId
                              ? "bg-purple-100 dark:bg-purple-600/20"
                              : ""
                          }`}
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">
                                {getFileIcon(share.originalFilename)}
                              </span>
                              <span className="text-neutral-900 dark:text-white">
                                {share.originalFilename}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-neutral-600 dark:text-neutral-400">
                            {share.recipientName} ({share.recipientEmail})
                          </td>
                          <td className="py-4 px-4 text-neutral-600 dark:text-neutral-400">
                            {new Date(share.sharedAt).toLocaleDateString(
                              "en-US",
                              {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              }
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                // GRID VIEW
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  {sharedByMeRecords.map((share) => (
                    <div
                      key={`${share.fileId}-${share.recipientUserId}`}
                      onClick={() => handleSharedByMeFileClick(share)}
                      className={`rounded-xl overflow-hidden shadow-md border ${
                        selectedSharedByMeFile?.fileId === share.fileId &&
                        selectedSharedByMeFile?.recipientUserId === share.recipientUserId
                          ? "border-purple-500 ring-2 ring-purple-500"
                          : "border-neutral-300 dark:border-neutral-700"
                      } bg-white dark:bg-purple-900/20 hover:scale-[1.02] hover:shadow-lg transition cursor-pointer`}
                    >
                      <div className="h-36 w-full bg-linear-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                        <span className="text-6xl">
                          {getFileIcon(share.originalFilename)}
                        </span>
                      </div>

                      <div className="p-4">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                          {share.originalFilename}
                        </p>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                          Shared with {share.recipientName}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                          {new Date(share.sharedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
          ownerName={selectedFile.sharedBy}
          showShareButton={false}
          isSharedFile={true}
        />
      )}

      {/* Folder Sidebar for "Shared With Me" */}
      {selectedFolder && (
        <FolderSidebar
          folder={selectedFolder as any}
          onClose={() => setSelectedFolder(null)}
          onOpenFolder={() =>
            navigate({ to: `/dashboard/folders/${selectedFolder.folderId}` })
          }
          onDownload={() => handleDownloadFolder(selectedFolder)}
          showShareButton={false}
          showDeleteButton={false}
          showDownloadButton={true}
          showOpenButton={true}
        />
      )}

      {/* File Sidebar for "Shared By Me" */}
      {selectedSharedByMeFile && (
        <FileSidebar
          file={convertShareRecordToFileMetadata(selectedSharedByMeFile)}
          onClose={() => setSelectedSharedByMeFile(null)}
          ownerName={selectedSharedByMeFile.recipientName}
          showShareButton={false}
          isSharedFile={false}
          sharedByMe={true}
        />
      )}

      {/* Folder Sidebar for "Shared By Me" */}
      {selectedSharedByMeFolder && (
        <FolderSidebar
          folder={convertSharedFolderRecordToFolder(selectedSharedByMeFolder) as any}
          onClose={() => setSelectedSharedByMeFolder(null)}
          onOpenFolder={() => navigate({ to: `/dashboard/folders/${selectedSharedByMeFolder.folderId}` })}
          ownerName={selectedSharedByMeFolder.recipientName}
          showShareButton={false}
          showDeleteButton={false}
          showDownloadButton={false}
          showOpenButton={true}
          sharedByMe={true}
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
            {formatFileSize(file.fileSize)} ·{" "}
            {new Date(file.sharedAt).toLocaleDateString()}
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
      ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-500"
          : "border-neutral-300 dark:border-neutral-700"
      }
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
          <span className="text-3xl">
            {getFileIcon(share.originalFilename)}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
            {share.originalFilename}
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            Shared with:{" "}
            <span className="font-medium">{share.recipientEmail}</span>
          </p>
          {share.recipientName && (
            <p className="text-xs text-neutral-500 dark:text-neutral-500">
              {share.recipientName}
            </p>
          )}
          <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
            {new Date(share.sharedAt).toLocaleDateString()} at{" "}
            {new Date(share.sharedAt).toLocaleTimeString()}
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
