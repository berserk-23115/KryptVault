import { authClient } from "@/lib/auth-client";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import React from "react";
import { Button } from "@/components/ui/button";
import {
  getFolderDetails,
  removeFileFromFolder,
  type FolderDetails,
  type FolderFile,
} from "@/lib/folders-api";
import { save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Filter,
  MoreVertical,
  Plus,
  ChevronRight,
  Grid3x3,
  List,
} from "lucide-react";
import {
  downloadAndDecryptSharedFile,
  unwrapSharedDek,
  unwrapDekWithFolderKey,
} from "@/lib/tauri-crypto";
import { FileSidebar } from "@/components/FileSidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { ButtonGroup } from "@/components/ui/button-group";

export const Route = createFileRoute("/dashboard/folders/$folderId")({
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
  const { folderId } = Route.useParams();
  const navigate = useNavigate();

  const [folderDetails, setFolderDetails] =
    React.useState<FolderDetails | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = React.useState<Set<string>>(
    new Set()
  );
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("list");
  const [selectedFile, setSelectedFile] = React.useState<FolderFile | null>(
    null
  );

  const loadFolderDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const details = await getFolderDetails(folderId);
      setFolderDetails(details);
      
      console.log("Folder details loaded:", details.folder.name);
      console.log("Wrapped folder key present:", !!details.folder.wrappedFolderKey);
      
      // Unwrap and store folder key in localStorage for file downloads
      const userKeysStr = localStorage.getItem("userKeypair");
      if (userKeysStr && details.folder.wrappedFolderKey) {
        try {
          const userKeys = JSON.parse(userKeysStr);
          const userPublicKey = userKeys.x25519PublicKey || userKeys.x25519_public_key;
          const userPrivateKey = userKeys.x25519PrivateKey || userKeys.x25519_private_key;
          
          if (userPublicKey && userPrivateKey) {
            console.log("Unwrapping folder key...");
            // Unwrap the folder key
            const folderKey = await unwrapSharedDek(
              details.folder.wrappedFolderKey,
              userPublicKey,
              userPrivateKey
            );
            
            // Store the unwrapped folder key
            localStorage.setItem(`folderKey_${folderId}`, folderKey);
            console.log("Folder key stored successfully");
          } else {
            console.error("User keypair incomplete");
            setError("Encryption keys not properly set up. Please check your keypair.");
          }
        } catch (keyErr) {
          console.error("Failed to unwrap folder key:", keyErr);
          setError("Failed to decrypt folder key. You may not have access to this folder.");
        }
      } else {
        console.warn("No wrapped folder key or user keypair found");
        if (!details.folder.wrappedFolderKey) {
          setError("Folder encryption key not found. This folder may not be properly configured.");
        }
      }
    } catch (err) {
      console.error("Failed to load folder details:", err);
      setError(err instanceof Error ? err.message : "Failed to load folder");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadFolderDetails();
  }, [folderId]);

  const handleDownload = async (file: FolderFile) => {
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
        description: "Preparing download...",
      });

      // Get download URL for the file from S3
      const API_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";
      const token = localStorage.getItem("bearer_token");
      
      const response = await fetch(`${API_URL}/api/files/${file.fileId}/download`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get download URL");
      }

      const downloadData = await response.json();

      // Check if we got wrappingNonce - this means it's a folder file
      if (downloadData.wrappingNonce) {
        // This is a folder file, need to unwrap DEK with folder key
        toast.loading(`Downloading ${file.originalFilename}...`, {
          id: toastId,
          description: "Unwrapping encryption key...",
        });

        // Get folder key from localStorage
        const folderKeyStr = localStorage.getItem(`folderKey_${folderId}`);
        if (!folderKeyStr) {
          // Try to unwrap the folder key again
          const userKeysStr = localStorage.getItem("userKeypair");
          if (!userKeysStr || !folderDetails) {
            throw new Error("Folder key not found. Please reload the page and try again.");
          }

          try {
            const userKeys = JSON.parse(userKeysStr);
            const userPublicKey = userKeys.x25519PublicKey || userKeys.x25519_public_key;
            const userPrivateKey = userKeys.x25519PrivateKey || userKeys.x25519_private_key;

            if (!userPublicKey || !userPrivateKey) {
              throw new Error("Encryption keys not properly configured.");
            }

            const folderKeyUnwrapped = await unwrapSharedDek(
              folderDetails.folder.wrappedFolderKey,
              userPublicKey,
              userPrivateKey
            );

            localStorage.setItem(`folderKey_${folderId}`, folderKeyUnwrapped);
            
            const dekBase64 = await unwrapDekWithFolderKey({
              wrapped_dek: downloadData.wrappedDek,
              wrapping_nonce: downloadData.wrappingNonce,
              folder_key_b64: folderKeyUnwrapped,
            });

            // Download and decrypt using the unwrapped DEK
            toast.loading(`Downloading ${file.originalFilename}...`, {
              id: toastId,
              description: "Downloading and decrypting file...",
            });

            await downloadAndDecryptSharedFile(
              downloadData.downloadUrl,
              dekBase64,
              downloadData.nonce,
              savePath
            );
            
            toast.success(`Download complete!`, {
              id: toastId,
              description: `Saved to: ${savePath}`,
            });
            return;
          } catch (unwrapError) {
            console.error("Failed to unwrap folder key during download:", unwrapError);
            throw new Error("Cannot access folder encryption key. This folder may have been shared with a different keypair. Please try regenerating your encryption keys.");
          }
        }

        const dekBase64 = await unwrapDekWithFolderKey({
          wrapped_dek: downloadData.wrappedDek,
          wrapping_nonce: downloadData.wrappingNonce,
          folder_key_b64: folderKeyStr,
        });

        // Download and decrypt using the unwrapped DEK
        toast.loading(`Downloading ${file.originalFilename}...`, {
          id: toastId,
          description: "Downloading and decrypting file...",
        });

        await downloadAndDecryptSharedFile(
          downloadData.downloadUrl,
          dekBase64,
          downloadData.nonce,
          savePath
        );
      } else {
        // This is a regular shared file or owner's file
        toast.loading(`Downloading ${file.originalFilename}...`, {
          id: toastId,
          description: "Unwrapping encryption key...",
        });

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

        // Unwrap the DEK using user's keypair
        const dekBase64 = await unwrapSharedDek(
          downloadData.wrappedDek,
          userPublicKey,
          userPrivateKey
        );

        // Download and decrypt
        toast.loading(`Downloading ${file.originalFilename}...`, {
          id: toastId,
          description: "Downloading and decrypting file...",
        });

        await downloadAndDecryptSharedFile(
          downloadData.downloadUrl,
          dekBase64,
          downloadData.nonce,
          savePath
        );
      }

      // Success
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

  const handleDelete = async (file: FolderFile) => {
    const toastId = toast.loading(`Removing ${file.originalFilename} from folder...`);
    
    try {
      setError(null);
      await removeFileFromFolder(folderId, file.fileId);
      
      // Reload folder details to update the file list
      await loadFolderDetails();
      
      // Clear selected file
      setSelectedFile(null);
      
      toast.success("File removed from folder", {
        id: toastId,
        description: `${file.originalFilename} has been removed from the folder successfully.`,
      });
    } catch (err) {
      console.error("Delete error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to remove file from folder";
      setError(errorMessage);
      
      toast.error("Failed to remove file", {
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

  if (loading) {
    return (
      <main className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white p-8">
        <div className="text-center py-12">
          <p className="text-neutral-500 dark:text-neutral-400">
            Loading folder...
          </p>
        </div>
      </main>
    );
  }

  if (!folderDetails) {
    return (
      <main className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white p-8">
        <div className="text-center py-12">
          <p className="text-red-500 dark:text-red-400">Folder not found</p>
          <Button
            onClick={() => navigate({ to: "/dashboard/my-files" })}
            className="mt-4"
          >
            Back to My Files
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-full overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
        {/* Header with Back Button */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate({ to: "/dashboard/my-files" })}
              variant={"ghost"}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              {/* <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                <span>My Files</span>
                <ChevronRight className="h-4 w-4" />
                <span className="text-neutral-900 dark:text-white">{folderDetails.folder.name}</span>
              </div> */}
              <h1 className="text-4xl font-bold text-neutral-900 dark:text-white">
                {folderDetails.folder.name}
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 mt-1">
                {folderDetails.files.length} file
                {folderDetails.files.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
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

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Files Table/Grid */}
        <div>
          {folderDetails.files.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-neutral-600 dark:text-neutral-500 mb-4">
                No files in this folder yet
              </p>
              <Button className="bg-purple-600 hover:bg-purple-700 gap-2">
                <Plus className="h-4 w-4" />
                Add Files to Folder
              </Button>
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
                    <th className="text-left py-4 px-4 font-semibold text-neutral-700 dark:text-neutral-300">
                      Name
                    </th>
                    {/* <th className="text-left py-4 px-4 font-semibold text-neutral-700 dark:text-neutral-300">
                      File Type
                    </th> */}
                    <th className="text-left py-4 px-4 font-semibold text-neutral-700 dark:text-neutral-300">
                      Size
                    </th>
                    <th className="text-left py-4 px-4 font-semibold text-neutral-700 dark:text-neutral-300">
                      Date Added
                    </th>
                    <th className="text-left py-4 px-4 font-semibold text-neutral-700 dark:text-neutral-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {folderDetails.files.map((file) => (
                    <tr
                      key={file.fileId}
                      onClick={() => setSelectedFile(file)}
                      className={`border-b border-neutral-300 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900/50 transition cursor-pointer ${
                        selectedFile?.fileId === file.fileId
                          ? "bg-purple-100 dark:bg-purple-600/20"
                          : ""
                      }`}
                    >
                      <td className="py-4 px-4">
                        <Checkbox
                          checked={selectedFile?.fileId === file.fileId}
                          onCheckedChange={() =>
                            setSelectedFile(
                              selectedFile?.fileId === file.fileId ? null : file
                            )
                          }
                        />
                      </td>
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
                      {/* <td className="py-4 px-4 text-neutral-600 dark:text-neutral-400">
                        {file.mimeType || "File"}
                      </td> */}
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
                              className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-neutral-200 dark:hover:bg-neutral-800"
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
                              className="hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer text-red-600 dark:text-red-400"
                            >
                              Remove from Folder
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
              {folderDetails.files.map((file) => (
                <div
                  key={file.fileId}
                  onClick={() => setSelectedFile(file)}
                  className={`rounded-xl overflow-hidden shadow-md border 
                ${
                  selectedFile?.fileId === file.fileId
                    ? "border-purple-500 ring-2 ring-purple-500"
                    : "border-neutral-300 dark:border-neutral-700"
                }
                bg-white dark:bg-purple-900/20 
                hover:scale-[1.02] hover:shadow-lg transition cursor-pointer`}
                >
                  <div className="h-36 w-full bg-linear-to-br from-purple-200 dark:from-purple-500/20 to-blue-200 dark:to-blue-500/20 flex items-center justify-center">
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

        {/* Folder Info Section
        <div className="mt-12 pt-8 border-t border-neutral-300 dark:border-neutral-800">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Folder Information</h3>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Owner</p>
              <p className="text-neutral-900 dark:text-white">{folderDetails.folder.ownerId}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Files</p>
              <p className="text-neutral-900 dark:text-white">{folderDetails.files.length}</p>
            </div>
          </div>
          {folderDetails.folder.description && (
            <div className="mt-6">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Description</p>
              <p className="text-neutral-900 dark:text-white">{folderDetails.folder.description}</p>
            </div>
          )}
        </div> */}
      </div>

      {/* Right Sidebar */}
      {selectedFile && (
        <FileSidebar
          file={selectedFile as any}
          onClose={() => setSelectedFile(null)}
          onPreview={() => handleDownload(selectedFile)}
          onDownload={() => handleDownload(selectedFile)}
          onDelete={() => handleDelete(selectedFile)}
          onShare={() => {}}
          ownerName={folderDetails?.folder.ownerName || folderDetails?.folder.ownerEmail || "Unknown"}
          showShareButton={false}
          isSharedFile={false}
        />
      )}
    </main>
  );
}
